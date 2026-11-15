package com.ainor.hiihive

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(PdfRenderPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Every device draws Rilvona in Inter, so text is the same width and cards never overflow on some phones.
    ReactFontManager.getInstance().addCustomFont(this, "Inter", R.font.inter)
    loadReactNative(this)
  }
}
