package com.ainor.hiihive

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Draws page one of a PDF to a PNG using Android's built-in renderer, so the app
 * can show documents (like the virtual ID card) without extra libraries.
 * The PDF is handed over as base64 and only ever touches the app's private cache.
 */
class PdfRenderModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName() = "PdfRender"

  @ReactMethod
  fun renderFirstPage(pdfBase64: String, targetWidth: Int, promise: Promise) {
    Thread {
          var file: File? = null
          try {
            val bytes = Base64.decode(pdfBase64, Base64.DEFAULT)
            file = File.createTempFile("render", ".pdf", context.cacheDir)
            file.writeBytes(bytes)
            ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
              PdfRenderer(fd).use { renderer ->
                if (renderer.pageCount < 1) throw IllegalStateException("The PDF has no pages")
                renderer.openPage(0).use { page ->
                  val width = targetWidth.coerceIn(200, 2400)
                  val height = (width.toFloat() * page.height / page.width).toInt().coerceAtLeast(1)
                  val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                  Canvas(bitmap).drawColor(Color.WHITE)
                  page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                  val out = ByteArrayOutputStream()
                  bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
                  bitmap.recycle()
                  promise.resolve(Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
                }
              }
            }
          } catch (e: Exception) {
            promise.reject("PDF_RENDER_FAILED", e.message ?: "Could not render the PDF", e)
          } finally {
            file?.delete()
          }
        }
        .start()
  }
}
