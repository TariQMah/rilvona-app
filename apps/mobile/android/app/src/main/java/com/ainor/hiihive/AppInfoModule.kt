package com.ainor.hiihive

import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

/** Tells the JS side which build is installed, so it can ask the server whether an update is needed. */
class AppInfoModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName() = "AppInfo"

  override fun getConstants(): Map<String, Any> {
    val info = context.packageManager.getPackageInfo(context.packageName, 0)
    val code =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode.toInt()
        else @Suppress("DEPRECATION") info.versionCode
    return mapOf("versionCode" to code, "versionName" to (info.versionName ?: ""))
  }
}
