package com.apex.locationtracker

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.apex.locationtracker.data.SupabaseManager
import com.apex.locationtracker.service.LocationTrackingService
import kotlinx.coroutines.launch
import java.util.Locale

class MainActivity : ComponentActivity() {
    private lateinit var supabaseManager: SupabaseManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supabaseManager = SupabaseManager(this)

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF10B981), // Emerald
                    background = Color(0xFF020617), // Slate 950
                    surface = Color(0xFF0F172A), // Slate 900
                    onPrimary = Color.Black,
                    onBackground = Color(0xFFF8FAFC),
                    onSurface = Color(0xFFF1F5F9)
                )
            ) {
                TrackerAppScreen(
                    supabaseManager = supabaseManager,
                    onStartService = { startLocationService() },
                    onStopService = { stopLocationService() },
                    onRequestBatteryWhitelist = { requestIgnoreBatteryOptimization() }
                )
            }
        }
    }

    private fun startLocationService() {
        val intent = Intent(this, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopLocationService() {
        val intent = Intent(this, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_STOP
        }
        startService(intent)
    }

    @SuppressLint("BatteryLife")
    private fun requestIgnoreBatteryOptimization() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:$packageName")
            }
            startActivity(intent)
        } else {
            Toast.makeText(this, "Battery optimization already disabled!", Toast.LENGTH_SHORT).show()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackerAppScreen(
    supabaseManager: SupabaseManager,
    onStartService: () -> Unit,
    onStopService: () -> Unit,
    onRequestBatteryWhitelist: () -> Unit
) {
    val liveState by LocationTrackingService.liveState.collectAsState()
    val context = androidx.compose.ui.platform.LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var showConfigModal by remember { mutableStateOf(!supabaseManager.isConfigured) }
    var offlineCount by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        offlineCount = supabaseManager.getOfflineCount()
    }

    // Permission Launchers
    val locationPermissionsLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        if (fineGranted) {
            Toast.makeText(context, "Location access granted", Toast.LENGTH_SHORT).show()
            if (supabaseManager.isConfigured) {
                onStartService()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "🛰️ Apex Tracker",
                            fontWeight = FontWeight.Bold,
                            fontSize = 20.sp
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showConfigModal = true }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color.LightGray)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color(0xFF020617)
                )
            )
        },
        containerColor = Color(0xFF020617)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Connection Status Banner
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (supabaseManager.isConfigured) Color(0xFF064E3B) else Color(0xFF7F1D1D)
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = if (supabaseManager.isConfigured) "🟢 Supabase Connected" else "🔴 Setup Required",
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            fontSize = 14.sp
                        )
                        Text(
                            text = if (supabaseManager.isConfigured) supabaseManager.deviceName else "Tap settings to enter Supabase credentials",
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp
                        )
                    }
                    if (!supabaseManager.isConfigured) {
                        Button(
                            onClick = { showConfigModal = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Color.White)
                        ) {
                            Text("Configure", color = Color.Black, fontSize = 12.sp)
                        }
                    }
                }
            }

            // Real-Time Speedometer & Metrics Card
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "LIVE VELOCITY",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF94A3B8)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = String.format(Locale.US, "%.1f", liveState.speedKmh),
                        fontSize = 54.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (liveState.isTracking) Color(0xFF10B981) else Color(0xFF64748B),
                        fontFamily = FontFamily.Monospace
                    )
                    Text(
                        text = "KM / HOUR",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF64748B)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Transport Mode Badge
                    AssistChip(
                        onClick = { },
                        label = {
                            Text(
                                text = when (liveState.transportMode) {
                                    "vehicle" -> "🚗 Vehicle Transit"
                                    "cycling" -> "🚴 Cycling"
                                    "walking" -> "🚶 Walking"
                                    else -> "🛑 Stationary / Parked"
                                },
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = Color(0xFF1E293B)
                        )
                    )
                }
            }

            // Hardware Telemetry Details
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "DEVICE TELEMETRY & GPS FIX",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF94A3B8)
                    )

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Coordinates:", color = Color(0xFF94A3B8), fontSize = 13.sp)
                        Text(
                            text = if (liveState.latitude != 0.0) "${String.format(Locale.US, "%.4f", liveState.latitude)}°, ${String.format(Locale.US, "%.4f", liveState.longitude)}°" else "Awaiting fix...",
                            color = Color.White,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("GPS Accuracy:", color = Color(0xFF94A3B8), fontSize = 13.sp)
                        Text(
                            text = if (liveState.accuracyMeters > 0) "±${String.format(Locale.US, "%.1f", liveState.accuracyMeters)} m" else "N/A",
                            color = Color(0xFF10B981),
                            fontSize = 13.sp
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Battery Status:", color = Color(0xFF94A3B8), fontSize = 13.sp)
                        Text(
                            text = "${liveState.batteryLevel.toInt()}% ${if (liveState.isCharging) "⚡ Charging" else ""}",
                            color = Color.White,
                            fontSize = 13.sp
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Transmitted Pings:", color = Color(0xFF94A3B8), fontSize = 13.sp)
                        Text(
                            text = "${liveState.totalPingsTransmitted} (${liveState.lastHttpStatus})",
                            color = Color(0xFF38BDF8),
                            fontSize = 13.sp
                        )
                    }
                }
            }

            // Tracking Control Button
            Button(
                onClick = {
                    if (liveState.isTracking) {
                        onStopService()
                    } else {
                        // Check permissions
                        val hasFine = ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.ACCESS_FINE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED

                        if (!hasFine) {
                            val perms = mutableListOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                perms.add(Manifest.permission.POST_NOTIFICATIONS)
                            }
                            locationPermissionsLauncher.launch(perms.toTypedArray())
                        } else {
                            onStartService()
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (liveState.isTracking) Color(0xFFE11D48) else Color(0xFF10B981)
                ),
                shape = RoundedCornerShape(14.dp)
            ) {
                Icon(
                    imageVector = if (liveState.isTracking) Icons.Default.Stop else Icons.Default.PlayArrow,
                    contentDescription = null,
                    tint = Color.White
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (liveState.isTracking) "STOP BACKGROUND TRACKING" else "START BACKGROUND TRACKING",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = Color.White
                )
            }

            // Battery Whitelist Exemption Banner
            OutlinedButton(
                onClick = onRequestBatteryWhitelist,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(Icons.Default.BatteryChargingFull, contentDescription = null, tint = Color(0xFFFBBF24))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Disable Battery Optimization (Recommended)", fontSize = 13.sp, color = Color(0xFFFBBF24))
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    // Settings Modal
    if (showConfigModal) {
        var inputUrl by remember { mutableStateOf(supabaseManager.supabaseUrl) }
        var inputAnonKey by remember { mutableStateOf(supabaseManager.anonKey) }
        var inputUserId by remember { mutableStateOf(supabaseManager.userId) }

        AlertDialog(
            onDismissRequest = { if (supabaseManager.isConfigured) showConfigModal = false },
            title = { Text("Supabase Pairing Config", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "Enter your project credentials or copy from Web Dashboard:",
                        fontSize = 12.sp,
                        color = Color.Gray
                    )

                    OutlinedTextField(
                        value = inputUrl,
                        onValueChange = { inputUrl = it },
                        label = { Text("Project URL (https://xyz.supabase.co)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = inputAnonKey,
                        onValueChange = { inputAnonKey = it },
                        label = { Text("Anon Public Key") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = inputUserId,
                        onValueChange = { inputUserId = it },
                        label = { Text("User Auth UUID (auth.users)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        supabaseManager.supabaseUrl = inputUrl
                        supabaseManager.anonKey = inputAnonKey
                        supabaseManager.userId = inputUserId
                        showConfigModal = false
                        Toast.makeText(context, "Credentials saved!", Toast.LENGTH_SHORT).show()
                    }
                ) {
                    Text("Save & Connect")
                }
            },
            dismissButton = {
                if (supabaseManager.isConfigured) {
                    TextButton(onClick = { showConfigModal = false }) {
                        Text("Close")
                    }
                }
            }
        )
    }
}
