package com.apex.locationtracker.data

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import com.google.gson.Gson
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
    private val prefs: SharedPreferences =
        context.getSharedPreferences("apex_tracker_prefs", Context.MODE_PRIVATE)

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
        private const val KEY_ANON_KEY = "supabase_anon_key"
        private const val KEY_USER_ID = "supabase_user_id"
        private const val KEY_DEVICE_ID = "apex_device_id"
        private const val KEY_DEVICE_NAME = "apex_device_name"
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
