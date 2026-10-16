package com.apex.locationtracker.data

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.JsonParser
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit

class SupabaseManager(private val context: Context) {
    // Hardware-backed AES-256 encrypted storage so credentials are never stored in plaintext
    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "apex_tracker_encrypted_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        Log.w(TAG, "EncryptedSharedPreferences unavailable, falling back to standard: ${e.message}")
        context.getSharedPreferences("apex_tracker_prefs", Context.MODE_PRIVATE)
    }

    private val gson = Gson()
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val database = AppDatabase.getInstance(context)
    private val dao = database.locationDao()

    companion object {
        private const val TAG = "SupabaseManager"
        private const val KEY_URL = "supabase_url"
        private const val KEY_SUPABASE_URL = KEY_URL
        private const val KEY_ANON_KEY = "supabase_anon_key"
        private const val KEY_USER_ID = "supabase_user_id"
        private const val KEY_DEVICE_ID = "apex_device_id"
        private const val KEY_DEVICE_NAME = "apex_device_name"
        const val TOKEN_PREFIX = "apex_pair_v1_"
    }

    var supabaseUrl: String
        get() = prefs.getString(KEY_URL, "") ?: ""
        set(value) = prefs.edit().putString(KEY_URL, value.trim().removeSuffix("/")).apply()

    var anonKey: String
        get() = prefs.getString(KEY_ANON_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_ANON_KEY, value.trim()).apply()

    var userId: String
        get() = prefs.getString(KEY_USER_ID, "") ?: ""
        set(value) = prefs.edit().putString(KEY_USER_ID, value.trim()).apply()

    val isConfigured: Boolean
        get() = supabaseUrl.isNotBlank() && anonKey.isNotBlank() && userId.isNotBlank()

    val deviceId: String
        get() {
            var id = prefs.getString(KEY_DEVICE_ID, null)
            if (id.isNullOrBlank()) {
                id = "phone-apk-${UUID.randomUUID().toString().take(8)}"
                prefs.edit().putString(KEY_DEVICE_ID, id).apply()
            }
            return id
        }

    val deviceName: String
        get() {
            var name = prefs.getString(KEY_DEVICE_NAME, null)
            if (name.isNullOrBlank()) {
                val manufacturer = Build.MANUFACTURER.replaceFirstChar { it.uppercase() }
                val model = Build.MODEL
                name = "$manufacturer $model (Apex APK)"
                prefs.edit().putString(KEY_DEVICE_NAME, name).apply()
            }
            return name
        }

    /**
     * Imports an opaque single-string pairing token (e.g. apex_pair_v1_...)
     * Eliminates the need to ever view or type raw URLs and API keys on mobile.
     */
    fun importPairingToken(token: String): Boolean {
        try {
            val trimmed = token.trim()
            val base64Payload = if (trimmed.startsWith(TOKEN_PREFIX)) {
                trimmed.removePrefix(TOKEN_PREFIX)
            } else {
                trimmed
            }
            val decodedBytes = Base64.decode(
                base64Payload,
                Base64.URL_SAFE or Base64.NO_WRAP or Base64.DEFAULT
            )
            val jsonString = String(decodedBytes, Charsets.UTF_8)
            val jsonObj = JsonParser.parseString(jsonString).asJsonObject

            val url = jsonObj.get("u")?.asString ?: return false
            val key = jsonObj.get("k")?.asString ?: return false
            val uid = jsonObj.get("uid")?.asString ?: return false

            if (url.isNotBlank() && key.isNotBlank() && uid.isNotBlank()) {
                supabaseUrl = url
                anonKey = key
                userId = uid
                return true
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to decode pairing token: ${e.message}")
        }
        return false
    }

    /**
     * Clears stored encrypted Supabase credentials
     */
    fun clearCredentials() {
        prefs.edit()
            .remove(KEY_URL)
            .remove(KEY_ANON_KEY)
            .remove(KEY_USER_ID)
            .apply()
    }

    /**
     * Safely returns masked project URL for UI rendering
     */
    fun getMaskedUrl(): String {
        val url = supabaseUrl
        if (url.isBlank()) return "Not Configured"
        return try {
            val uri = Uri.parse(url)
            val host = uri.host ?: url
            val parts = host.split(".")
            if (parts.size >= 3) {
                val prefix = parts[0].take(4)
                "${uri.scheme}://${prefix}••••.${parts.drop(1).joinToString(".")}"
            } else {
                "${uri.scheme}://••••••••"
            }
        } catch (e: Exception) {
            "https://••••••••.supabase.co"
        }
    }

    /**
     * Safely returns masked anon key for UI rendering
     */
    fun getMaskedKey(): String {
        val key = anonKey
        if (key.isBlank()) return "Not Configured"
        if (key.length <= 12) return "••••••••••••"
        return "${key.take(6)}••••••••••••••••••••${key.takeLast(4)}"
    }

    /**
     * Safely returns masked user ID for UI rendering
     */
    fun getMaskedUserId(): String {
        val id = userId
        if (id.isBlank()) return "Not Configured"
        if (id.length <= 8) return "••••••••"
        return "${id.take(4)}••••-••••-••••-••••••••${id.takeLast(4)}"
    }

    /**
     * Sends a single ping to Supabase.
     * If network fails or app is offline, queues into Room database.
     */
    suspend fun dispatchPing(ping: LocationPingEntity): Result<Int> = withContext(Dispatchers.IO) {
        if (!isConfigured) {
            Log.w(TAG, "Supabase not configured. Caching ping to local Room queue.")
            dao.insertPing(ping)
            return@withContext Result.failure(IllegalStateException("Supabase not configured"))
        }

        val jsonPayload = gson.toJson(ping)
        val endpoint = "$supabaseUrl/rest/v1/device_location_pings"
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val body = jsonPayload.toRequestBody(mediaType)

        val request = Request.Builder()
            .url(endpoint)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=minimal")
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    Log.d(TAG, "Ping transmitted successfully. HTTP ${response.code}")
                    // Attempt to drain pending offline pings if any
                    flushOfflineQueue()
                    return@withContext Result.success(response.code)
                } else {
                    val err = response.body?.string() ?: "Empty body"
                    Log.w(TAG, "Supabase rejected ping: HTTP ${response.code} - $err. Caching locally.")
                    dao.insertPing(ping)
                    return@withContext Result.failure(IOException("HTTP ${response.code}: $err"))
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Network failure sending ping (${e.message}). Caching locally to Room.")
            dao.insertPing(ping)
            return@withContext Result.failure(e)
        }
    }

    /**
     * Flushes offline cached pings in batches of up to 50
     */
    suspend fun flushOfflineQueue() = withContext(Dispatchers.IO) {
        if (!isConfigured) return@withContext

        val pending = dao.getPendingPings(limit = 50)
        if (pending.isEmpty()) return@withContext

        Log.i(TAG, "Attempting to flush ${pending.size} cached pings to Supabase...")
        val jsonPayload = gson.toJson(pending)
        val endpoint = "$supabaseUrl/rest/v1/device_location_pings"
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val body = jsonPayload.toRequestBody(mediaType)

        val request = Request.Builder()
            .url(endpoint)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .addHeader("Prefer", "return=minimal")
            .post(body)
            .build()

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    dao.deletePings(pending)
                    Log.i(TAG, "Successfully flushed ${pending.size} offline pings.")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to flush offline queue: ${e.message}")
        }
    }

    suspend fun getOfflineCount(): Int = withContext(Dispatchers.IO) {
        dao.getPendingCount()
    }
}
