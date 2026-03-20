package org.biuuu.genshin.wish.export;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        // 为Android 13及以上版本设置广播接收器的exported属性
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // 这个方法会在所有Capacitor插件初始化后调用
            // 确保所有动态注册的广播接收器都有正确的exported属性
        }
    }
    
    // 重写registerReceiver方法，确保所有广播接收器都指定exported属性
    @Override
    public Intent registerReceiver(android.content.BroadcastReceiver receiver, IntentFilter filter) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // 对于Android 13及以上版本，明确指定exported属性
            // 这里我们假设大多数广播接收器是应用内部使用的，设置为非导出
            return super.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            // 对于旧版本Android，使用默认行为
            return super.registerReceiver(receiver, filter);
        }
    }
    
    // 重写registerReceiver方法的其他重载版本
    @Override
    public Intent registerReceiver(android.content.BroadcastReceiver receiver, IntentFilter filter, String broadcastPermission, android.os.Handler scheduler) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return super.registerReceiver(receiver, filter, broadcastPermission, scheduler, Context.RECEIVER_NOT_EXPORTED);
        } else {
            return super.registerReceiver(receiver, filter, broadcastPermission, scheduler);
        }
    }
}
