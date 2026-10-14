package com.apex.locationtracker.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface LocationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPing(ping: LocationPingEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPings(pings: List<LocationPingEntity>)

    @Query("SELECT * FROM offline_location_pings ORDER BY recordedAt ASC LIMIT :limit")
    suspend fun getPendingPings(limit: Int = 50): List<LocationPingEntity>

    @Query("SELECT COUNT(*) FROM offline_location_pings")
    suspend fun getPendingCount(): Int

    @Delete
    suspend fun deletePings(pings: List<LocationPingEntity>)

    @Query("DELETE FROM offline_location_pings WHERE id IN (:ids)")
    suspend fun deleteByIds(ids: List<String>)
}
