package com.invotracker.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.database.Cursor;
import android.content.ContentValues;
import org.json.JSONObject;
import org.json.JSONArray;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import android.util.Base64;

public class MainActivity extends Activity {
  private WebView webView;
  private OfflineBridge bridge;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    webView = new WebView(this);
    webView.getSettings().setJavaScriptEnabled(true);
    webView.getSettings().setDomStorageEnabled(true);
    webView.setWebChromeClient(new WebChromeClient());
    webView.setWebViewClient(new WebViewClient());
    bridge = new OfflineBridge();
    webView.addJavascriptInterface(bridge, "InvoOffline");
    setContentView(webView);
    webView.loadUrl("file:///android_asset/index.html");
  }
  private class DB extends SQLiteOpenHelper {
    DB() { super(MainActivity.this,"invotracker_offline.db",null,1); }
    @Override public void onCreate(SQLiteDatabase db) {
      db.execSQL("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, business_name TEXT NOT NULL, industry TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion) { }
  }
  private class OfflineBridge {
    private final DB helper = new DB();
    private long userId = -1;
    private String hash(String password,byte[] salt) throws Exception {
      KeySpec spec = new PBEKeySpec(password.toCharArray(),salt,150000,256);
      byte[] result = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
      return Base64.encodeToString(result,Base64.NO_WRAP);
    }
    private JSONObject ok(Object data) throws Exception {return new JSONObject().put("ok",true).put("data",data);}
    private JSONObject fail(String msg) throws Exception {return new JSONObject().put("ok",false).put("error",msg);}
    @JavascriptInterface public synchronized String request(String method,String path,String body) {
      try { return handle(method,path,new JSONObject(body)).toString(); }
      catch(Exception e) {try{return fail(e.getMessage()==null?"Offline error":e.getMessage()).toString();}catch(Exception ignored){return "{\"ok\":false,\"error\":\"Offline error\"}";}}
    }
    private JSONObject handle(String method,String path,JSONObject b) throws Exception {
      SQLiteDatabase db=helper.getWritableDatabase();
      if (path.equals("/api/auth/register") && method.equals("POST")) {
        String email=b.optString("email").trim().toLowerCase(java.util.Locale.ROOT);
        String password=b.optString("password");
        String business=b.optString("businessName").trim();
        String industry=b.optString("industry").trim();
        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches() || password.length()<8 || business.isEmpty() || industry.isEmpty())return fail("Enter valid account details (password minimum 8 characters).");
        byte[] salt=new byte[16];new SecureRandom().nextBytes(salt);
        ContentValues v=new ContentValues();v.put("email",email);v.put("business_name",business);v.put("industry",industry);v.put("salt",Base64.encodeToString(salt,Base64.NO_WRAP));v.put("hash",hash(password,salt));
        if(db.insertWithOnConflict("users",null,v,SQLiteDatabase.CONFLICT_IGNORE)<0)return fail("Email already registered on this phone.");
        return ok(new JSONObject().put("message","Account created"));
      }
      if (path.equals("/api/auth/login") && method.equals("POST")) {
        String email=b.optString("email").trim().toLowerCase(java.util.Locale.ROOT);
        try(Cursor c=db.rawQuery("SELECT id,salt,hash FROM users WHERE email=?",new String[]{email})){
          if(!c.moveToFirst())return fail("Invalid email or password.");
          String computed=hash(b.optString("password"),Base64.decode(c.getString(1),Base64.NO_WRAP));
          if(!java.security.MessageDigest.isEqual(computed.getBytes(java.nio.charset.StandardCharsets.UTF_8),c.getString(2).getBytes(java.nio.charset.StandardCharsets.UTF_8)))return fail("Invalid email or password.");
          userId=c.getLong(0);
        }
        return ok(new JSONObject().put("message","Signed in"));
      }
      if(path.equals("/api/auth/logout") && method.equals("POST")){userId=-1;return ok(new JSONObject());}
      if(userId<0)return fail("Please log in to your offline account.");
      if(path.equals("/api/auth/me")){
        try(Cursor c=db.rawQuery("SELECT email,business_name,industry FROM users WHERE id=?",new String[]{String.valueOf(userId)})){
          if(!c.moveToFirst())return fail("Account not found.");
          return ok(new JSONObject().put("email",c.getString(0)).put("businessName",c.getString(1)).put("industry",c.getString(2)));
        }
      }
      if(method.equals("GET") && path.equals("/api/invoices"))return ok(new JSONArray());
      if(method.equals("GET") && path.equals("/api/invoices/summary"))return ok(new JSONObject().put("invoiceCount",0).put("totalInvoiced",0).put("totalPaid",0).put("outstanding",0).put("overdueCount",0));
      if(method.equals("GET") && (path.equals("/api/products")||path.equals("/api/contacts")))return ok(new JSONArray());
      return fail("This feature is not yet available offline: "+method+" "+path);
    }
  }
}
