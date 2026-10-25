package com.noted.app;

import static org.junit.Assert.*;
import static com.noted.app.NativeTransferTest.evaluate;
import static com.noted.app.NativeTransferTest.launchActivity;
import android.content.Intent;
import android.os.SystemClock;
import android.view.MotionEvent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.UUID;

/** Opt-in test of the signed-in app. Creates and deletes only its own note. */
@RunWith(AndroidJUnit4.class)
public class NativeContentTest {
  private JSONObject json(String literal) throws Exception {
    return new JSONObject(new JSONArray("["+literal+"]").getString(0));
  }
  private void waitFor(MainActivity app,String condition) throws Exception {
    for(int n=0;n<150;n++) {
      if("true".equals(evaluate(app,condition))) return;
      Thread.sleep(200);
    }
    fail("Condition did not become true: "+condition);
  }
  private void pointer(long down,int action,float x,float y) {
    MotionEvent event=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,x,y,0);
    InstrumentationRegistry.getInstrumentation().sendPointerSync(event);
    event.recycle();
  }
  private void openFridge(MainActivity app) throws Exception {
      waitFor(app,"!!document.querySelector('#homes-title')");
      int index=Integer.parseInt(InstrumentationRegistry.getArguments().getString("homeIndex","0"));
      waitFor(app,"Array.from(document.links).filter(a=>a.getAttribute('href')?.startsWith('/app/homes/')).length>"+index);
      evaluate(app,"Array.from(document.links).filter(a=>a.getAttribute('href')?.startsWith('/app/homes/'))["+index+"].click()");
      waitFor(app,"Array.from(document.querySelectorAll('button')).some(b=>b.getAttribute('aria-label')==='Previous home scene')");
      for(int scene=0;scene<3;scene++) {
        if("true".equals(evaluate(app,"Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('+ Note'))"))) break;
        evaluate(app,"Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Previous home scene').click()");
        Thread.sleep(2000);
      }
      waitFor(app,"Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('+ Note'))");
  }
  @Test public void draggingDoesNotSnapBackBeforeLocalSave() throws Exception {
    org.junit.Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("interactive")));
    Intent intent=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    MainActivity app=(MainActivity)launchActivity(intent);
    String fixture="Android repair smoke "+UUID.randomUUID();
    String selector="[aria-label='Note: "+fixture+"']";
    try {
      openFridge(app);
      evaluate(app,"Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('+ Note')).click()");
      waitFor(app,"!!document.querySelector('textarea')");
      evaluate(app,"(()=>{const t=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,"+JSONObject.quote(fixture)+");t.dispatchEvent(new Event('input',{bubbles:true}));})()");
      waitFor(app,"!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Stick it'&&!b.disabled)");
      evaluate(app,"Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Stick it').click()");
      waitFor(app,"!!document.querySelector("+JSONObject.quote(selector)+")");
      // Wait for the appliance entrance so a native drag targets stable geometry.
      Thread.sleep(3500);
      JSONObject geometry=json(evaluate(app,"JSON.stringify((()=>{const e=document.querySelector("+JSONObject.quote(selector)+");const r=e.getBoundingClientRect();window.__dragCard=e;window.__oldPosition=e.style.left;window.__dragFrames=[];window.__recordRelease=false;const frame=()=>{if(window.__recordRelease)window.__dragFrames.push(e.style.left);if(window.__dragFrames.length<30)requestAnimationFrame(frame);};requestAnimationFrame(frame);return {x:r.x+r.width/2,y:r.y+r.height/2,scale:innerWidth};})())"));
      int[] location=new int[2];
      InstrumentationRegistry.getInstrumentation().runOnMainSync(()->app.getBridge().getWebView().getLocationOnScreen(location));
      double scale=app.getBridge().getWebView().getWidth()/geometry.getDouble("scale");
      float x=(float)(geometry.getDouble("x")*scale+location[0]);
      float y=(float)(geometry.getDouble("y")*scale+location[1]);
      long down=SystemClock.uptimeMillis();
      pointer(down,MotionEvent.ACTION_DOWN,x,y);
      for(int n=1;n<=10;n++){pointer(down,MotionEvent.ACTION_MOVE,x+12*n,y+3*n);Thread.sleep(20);}
      evaluate(app,"window.__recordRelease=true");
      pointer(down,MotionEvent.ACTION_UP,x+120,y+30);
      waitFor(app,"window.__dragFrames?.length>=30");
      assertEquals("The note snapped to its old position after release","true",evaluate(app,"window.__dragFrames.every(p=>p!==window.__oldPosition)"));
      System.out.println("DRAG_FRAMES_CHECKED="+evaluate(app,"window.__dragFrames.length"));
    } finally {
      // Keep cleanup on the app's normal, version-checked deletion path.
      if("true".equals(evaluate(app,"!!document.querySelector("+JSONObject.quote(selector)+")"))) {
        Thread.sleep(2500);
        evaluate(app,"document.querySelector("+JSONObject.quote(selector)+").dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
        waitFor(app,"!!document.querySelector('button[aria-label=\"Delete note\"]')");
        evaluate(app,"document.querySelector('button[aria-label=\"Delete note\"]').click()");
        waitFor(app,"!document.querySelector("+JSONObject.quote(selector)+")");
        System.out.println("DISPOSABLE_NOTE_REMOVED=true");
      }
      InstrumentationRegistry.getInstrumentation().runOnMainSync(app::finish);
    }
  }
  private void openBook(MainActivity app) throws Exception {
    for(int scene=0;scene<6;scene++) {
      if("true".equals(evaluate(app,"!!document.querySelector('[aria-label=\"Photo book\"]')"))) return;
      evaluate(app,"Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Next home scene').click()");
      Thread.sleep(2000);
    }
    fail("Photobook did not open");
  }
  private void removeArchivedFixture(MainActivity app,String asset) throws Exception {
    UUID.fromString(asset);
    String selector="[data-native-asset='"+asset+"']";
    String live="Array.from(document.querySelectorAll("+JSONObject.quote(selector)+")).find(e=>!e.closest('[inert],[aria-hidden=true]'))";
    waitFor(app,"!!Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Next photobook pages')");
    for(int page=0;page<20;page++){
      if("true".equals(evaluate(app,"!!("+live+")"))) break;
      evaluate(app,"Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Next photobook pages'&&!b.disabled)?.click()");
      Thread.sleep(1500);
    }
    waitFor(app,"!!("+live+")");
    evaluate(app,"("+live+").click()");
    waitFor(app,"!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Delete forever')");
    evaluate(app,"Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Delete forever').click()");
    waitFor(app,"!("+live+")");
  }
  @Test public void photoReachesServerAndCanBeRemoved() throws Exception {
    org.junit.Assume.assumeTrue("true".equals(InstrumentationRegistry.getArguments().getString("interactive")));
    Intent intent=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    MainActivity app=(MainActivity)launchActivity(intent);
    String asset=null;
    try {
      openFridge(app);
      evaluate(app,"window.__beforeAssets=Array.from(document.querySelectorAll('[data-native-asset]')).map(e=>e.dataset.nativeAsset);Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('+ Photo')).click()");
      waitFor(app,"!!document.querySelector('input[type=file]')");
      evaluate(app,"(()=>{const canvas=document.createElement('canvas');canvas.width=43;canvas.height=37;const ctx=canvas.getContext('2d');ctx.fillStyle='#0ecafe';ctx.fillRect(0,0,43,37);ctx.fillStyle='#152839';ctx.fillText('QA',3,20);canvas.toBlob(blob=>{const dt=new DataTransfer();dt.items.add(new File([blob],'android-repair-fixture.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));},'image/png');})()");
      waitFor(app,"!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Stick it'&&!b.disabled)");
      evaluate(app,"Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Stick it').click()");
      waitFor(app,"Array.from(document.querySelectorAll('[data-native-asset]')).some(e=>!window.__beforeAssets.includes(e.dataset.nativeAsset))");
      asset=new JSONArray("["+evaluate(app,"Array.from(document.querySelectorAll('[data-native-asset]')).find(e=>!window.__beforeAssets.includes(e.dataset.nativeAsset)).dataset.nativeAsset")+"]").getString(0);
      UUID.fromString(asset);
      String filename=app.databaseList()[0].replace("SQLite.db","");
      boolean accepted=false;
      for(int n=0;n<120;n++) {
        evaluate(app,"window.__photoRow=null;Capacitor.nativePromise('CapacitorSQLite','query',{database:"+JSONObject.quote(filename)+",readonly:true,statement:'SELECT has_synced FROM attachments WHERE id=?',values:["+JSONObject.quote(asset)+"]}).then(r=>window.__photoRow=r.values?.[0]);");
        Thread.sleep(500);
        if("true".equals(evaluate(app,"window.__photoRow?.has_synced===1"))){accepted=true;break;}
      }
      assertTrue("Original never received server verification",accepted);
      String selector="[data-native-asset='"+asset+"']";
      waitFor(app,"!!document.querySelector("+JSONObject.quote(selector+" img")+")?.naturalWidth");
      System.out.println("PHOTO_ORIGINAL_VERIFIED="+asset);
      // This is the synthetic QA image above; cleanup uses both normal UI steps.
      evaluate(app,"document.querySelector("+JSONObject.quote(selector)+").dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
      waitFor(app,"!!Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Archive photo to the book')");
      evaluate(app,"Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Archive photo to the book').click()");
      waitFor(app,"!document.querySelector("+JSONObject.quote(selector)+")");
      openBook(app);
      removeArchivedFixture(app,asset);
      System.out.println("DISPOSABLE_PHOTO_REMOVED=true");
    } finally {InstrumentationRegistry.getInstrumentation().runOnMainSync(app::finish);}
  }

  /** Cleanup for a failed opt-in run; accepts only an explicitly identified fixture. */
  @Test public void cleanupFailedPhotoFixture() throws Exception {
    String asset=InstrumentationRegistry.getArguments().getString("fixtureAsset");
    org.junit.Assume.assumeNotNull(asset);
    UUID.fromString(asset);
    Intent intent=new Intent(InstrumentationRegistry.getInstrumentation().getTargetContext(),MainActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    MainActivity app=(MainActivity)launchActivity(intent);
    try {openFridge(app);openBook(app);removeArchivedFixture(app,asset);}
    finally {InstrumentationRegistry.getInstrumentation().runOnMainSync(app::finish);}
  }

}
