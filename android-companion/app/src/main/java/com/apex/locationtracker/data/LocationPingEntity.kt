package com.apex.locationtracker.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName
import java.util.UUID

@Entity(tableName = "offline_location_pings")
data class LocationPingEntity(
    @PrimaryKey
    @SerializedName("id")
    val id: String = UUID.randomUUID().toString(),

    @SerializedName("user_id")
    val userId: String,

    @SerializedName("device_id")
    val deviceId: String,

    @SerializedName("device_name")
    val deviceName: String,

    @SerializedName("latitude")
    val latitude: Double,

    @SerializedName("longitude")
    val longitude: Double,

    @SerializedName("altitude")
    val altitude: Double?,

    @SerializedName("accuracy_meters")
    val accuracyMeters: Float?,

    @SerializedName("speed_kmh")
    val speedKmh: Float,

    @SerializedName("heading")
    val heading: Float?,

    @SerializedName("battery_level")
    val batteryLevel: Float?,

    @SerializedName("is_charging")
    val isCharging: Boolean,

    @SerializedName("transport_mode")
    val transportMode: String,

    @SerializedName("recorded_at")
    val recordedAt: String
)
