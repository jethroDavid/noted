package com.noted.app;

import static org.junit.Assert.*;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/** Exercises the packaged Capacitor bridge against a short-lived signed S3 PUT. */
@RunWith(AndroidJUnit4.class)
public class NativeTransferTest {
  static android.app.Activity launchActivity(Intent intent) {
    android.app.Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
    android.app.Instrumentation.ActivityMonitor monitor=instrumentation.addMonitor(MainActivity.class.getName(),null,false);
    instrumentation.getTargetContext().startActivity(intent);
    android.app.Activity activity=monitor.waitForActivityWithTimeout(30000);
    instrumentation.removeMonitor(monitor);
    assertNotNull("Native activity did not resume",activity);
    return activity;
  }
  static String evaluate(MainActivity activity, String script) throws Exception {
    CountDownLatch done = new CountDownLatch(1);
    AtomicReference<String> result = new AtomicReference<>();
    InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
      activity.getBridge().getWebView().evaluateJavascript(script, value -> {result.set(value); done.countDown();}));
    assertTrue("WebView did not respond", done.await(10, TimeUnit.SECONDS));
    return result.get();
  }
  @Test public void browserClosesAndAuthLinkResolves() throws Exception {
    Intent intent = new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    MainActivity activity=(MainActivity) launchActivity(intent);
    try {
      Intent link=new Intent(Intent.ACTION_VIEW,android.net.Uri.parse("com.noted.app://auth/complete"));
      link.addCategory(Intent.CATEGORY_BROWSABLE);
      assertNotNull("Android auth return link is not registered",activity.getPackageManager().resolveActivity(link,0));
      for(int n=0;n<60;n++) {
        if("true".equals(evaluate(activity,"!!window.Capacitor?.nativePromise"))) break;
        Thread.sleep(500);
      }
      evaluate(activity,"window.__browserResult=null; (async()=>{try{const call=(p,m,o)=>Capacitor.nativePromise(p,m,o);await call('Browser','open',{url:'https://example.com'});await new Promise(r=>setTimeout(r,1500));await call('Browser','close',{});await new Promise(r=>setTimeout(r,1000));window.__browserResult=await call('App','getState',{});}catch(e){window.__browserResult={code:e.code};}})();");
      String result="null";
      for(int n=0;n<40;n++) {
        result=evaluate(activity,"JSON.stringify(window.__browserResult)");
        if(!"\"null\"".equals(result) && !"null".equals(result)) break;
        Thread.sleep(500);
      }
      assertTrue("Browser did not return to native app: "+result,result.contains("isActive\\\":true"));
      assertEquals("true",evaluate(activity,"!!document.querySelector('#homes-title') || (!!document.querySelector('.login-scene') && document.body.innerText.includes('Come on in.'))"));
    } finally {InstrumentationRegistry.getInstrumentation().runOnMainSync(activity::finish);}
  }
  @Test public void inspectSignedInHome() throws Exception {
    org.junit.Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("interactive")));
    Intent intent=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    MainActivity activity=(MainActivity)launchActivity(intent);
    try {
      for(int n=0;n<100;n++) {
        if("true".equals(evaluate(activity,"!!document.querySelector('#homes-title')"))) break;
        Thread.sleep(500);
      }
      assertEquals("Home list did not render after sign-in","true",evaluate(activity,"!!document.querySelector('#homes-title')"));
      String filename=activity.databaseList()[0].replace("SQLite.db","");
      String sql="SELECT 'assets' AS kind,count(*) AS count FROM media_assets UNION ALL SELECT 'posts',count(*) FROM posts UNION ALL SELECT 'attachments',count(*) FROM attachments UNION ALL SELECT 'requested',count(*) FROM media_views WHERE requested=1 UNION ALL SELECT 'failed',count(*) FROM media_failures";
      evaluate(activity,"window.__inspection=null; Capacitor.nativePromise('CapacitorSQLite','query',{database:"+JSONObject.quote(filename)+",readonly:true,statement:"+JSONObject.quote(sql)+",values:[]}).then(r=>window.__inspection=r).catch(e=>window.__inspection={error:e.message});");
      Thread.sleep(1000);
      System.out.println("LOCAL_QUEUE_COUNTS="+evaluate(activity,"JSON.stringify(window.__inspection)"));
      System.out.println("HOME_LINK_COUNT="+evaluate(activity,"document.querySelectorAll('a[href^=\"/app/homes/\"]').length"));

      android.graphics.Bitmap homes=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
      try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(activity.getExternalFilesDir(null),"native-smoke-homes.png"))){homes.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}
      int homeIndex=Integer.parseInt(InstrumentationRegistry.getArguments().getString("homeIndex","0"));
      evaluate(activity,"Array.from(document.links).filter(a=>a.getAttribute('href')?.startsWith('/app/homes/'))["+homeIndex+"].click()");
      for(int n=0;n<60;n++){
        if("true".equals(evaluate(activity,"!!Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Previous home scene')"))) break;
        Thread.sleep(500);
      }
      evaluate(activity,"Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Previous home scene').click()");
      for(int n=0;n<60;n++){
        if("true".equals(evaluate(activity,"!!document.querySelector('[data-native-asset]')"))) break;
        Thread.sleep(500);
      }
      Thread.sleep(10000);
      evaluate(activity,"window.__inspection=null; Capacitor.nativePromise('CapacitorSQLite','query',{database:"+JSONObject.quote(filename)+",readonly:true,statement:"+JSONObject.quote(sql)+",values:[]}).then(r=>window.__inspection=r).catch(e=>window.__inspection={error:e.message});");
      Thread.sleep(1000);
      System.out.println("VISIBLE_MEDIA_COUNTS="+evaluate(activity,"JSON.stringify(window.__inspection)"));
      android.graphics.Bitmap board=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
      try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(activity.getExternalFilesDir(null),"native-smoke-board.png"))){board.compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);}
      assertEquals("Visible media did not request downloads","true",evaluate(activity,"window.__inspection?.values?.some(r=>r.kind==='requested'&&r.count>0)"));
    } finally {InstrumentationRegistry.getInstrumentation().runOnMainSync(activity::finish);}
  }
  @Test public void signedBinaryUpload() throws Exception {
    String url = InstrumentationRegistry.getArguments().getString("uploadUrl");
    String checksum = InstrumentationRegistry.getArguments().getString("checksum");
    org.junit.Assume.assumeNotNull(url, checksum);
    Intent intent = new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    MainActivity activity = (MainActivity) launchActivity(intent);
    try {
      for(int n=0;n<60;n++) {
        if("true".equals(evaluate(activity,"!!window.Capacitor?.nativePromise"))) break;
        Thread.sleep(500);
      }
      String js = "window.__transferResult=null; (async()=>{try {"
        + "const call=(p,m,o)=>Capacitor.nativePromise(p,m,o);"
        + "const bytes=Uint8Array.from({length:524311},(_,i)=>i%256);"
        + "const path='native-transfer-fixture.bin';"
        + "await call('Filesystem','writeFile',{path,directory:'DATA',data:''});"
        + "for(let offset=0;offset<bytes.length;offset+=196608){let binary='';const chunk=bytes.subarray(offset,offset+196608);for(let i=0;i<chunk.length;i+=8192)binary+=String.fromCharCode(...chunk.subarray(i,i+8192));await call('Filesystem','appendFile',{path,directory:'DATA',data:btoa(binary)});}"
        + "const file=await call('Filesystem','getUri',{path,directory:'DATA'});"
        + "await call('FileTransfer','uploadFile',{url:" + JSONObject.quote(url) + ",path:file.uri,method:'PUT',chunkedMode:false,headers:{'Content-Type':'application/octet-stream','x-amz-checksum-sha256':" + JSONObject.quote(checksum) + "},shouldEncodeUrlParams:false});"
        + "window.__transferResult={ok:true};"
        + "}catch(e){window.__transferResult={ok:false,code:e.code,status:e.data?.httpStatus,s3message:e.data?.body?.split('<Message>')[1]?.split('</Message>')[0],unsigned:e.data?.body?.split('<HeadersNotSigned>')[1]?.split('</HeadersNotSigned>')[0],s3code:e.data?.body?.split('<Code>')[1]?.split('</Code>')[0],message:e.message};}})();";
      evaluate(activity,js);
      String result="null";
      for(int n=0;n<150;n++) {
        result=evaluate(activity,"JSON.stringify(window.__transferResult)");
        if(!"\"null\"".equals(result) && !"null".equals(result)) break;
        Thread.sleep(500);
      }
      assertTrue("Native transfer failed: " + result, result.contains("\\\"ok\\\":true") || result.contains("\"ok\":true"));
    } finally { InstrumentationRegistry.getInstrumentation().runOnMainSync(activity::finish); }
  }
}
