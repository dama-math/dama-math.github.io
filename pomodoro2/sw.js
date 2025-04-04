// sw.js

// Service Worker が管理する通知IDを保持する変数
let notificationTimeoutId = null;
let scheduledNotifications = {}; // tagをキーにしたタイムアウトID管理

self.addEventListener('install', event => {
    console.log('Service Worker installing.');
    // self.skipWaiting(); // 必要に応じて古いSWをすぐに置き換える
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating.');
    // 古いキャッシュの削除など
    // event.waitUntil(clients.claim()); // すぐに制御を開始する場合
});

self.addEventListener('message', event => {
    console.log('SW received message:', event.data);
    if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
        const { title, options, timestamp } = event.data.payload;
        const delay = timestamp - Date.now();
        const notificationTag = options.tag || 'pomodoro-timer-notification'; // タグを取得

        // 既存の同じタグの通知があればキャンセル
        if (scheduledNotifications[notificationTag]) {
             clearTimeout(scheduledNotifications[notificationTag]);
             console.log(`SW cleared previous timeout for tag: ${notificationTag}`);
        }


        if (delay > 0) {
            console.log(`SW scheduling notification "${title}" in ${delay}ms with tag: ${notificationTag}`);
            const timeoutId = setTimeout(() => {
                console.log(`SW showing notification: "${title}"`);
                // self.registration.showNotification は Service Worker のスコープ内でNotification APIを呼び出す
                self.registration.showNotification(title, options)
                    .then(() => console.log(`SW notification shown: "${title}"`))
                    .catch(err => console.error('SW notification error:', err));
                // 通知表示後に管理から削除
                delete scheduledNotifications[notificationTag];

            }, delay);
             // 新しいタイムアウトIDを管理
            scheduledNotifications[notificationTag] = timeoutId;

        } else {
            console.log(`SW: Notification delay is not positive (${delay}ms), not scheduling.`);
        }
    } else if (event.data && event.data.type === 'CANCEL_NOTIFICATION') {
         const notificationTag = event.data.tag || 'pomodoro-timer-notification'; // キャンセル対象のタグ
         if (scheduledNotifications[notificationTag]) {
            clearTimeout(scheduledNotifications[notificationTag]);
            delete scheduledNotifications[notificationTag];
            console.log(`SW cancelled scheduled notification with tag: ${notificationTag}`);
        } else {
             console.log(`SW: No scheduled notification found with tag: ${notificationTag} to cancel.`);
        }
    }
});

// (オプション) 通知クリック時のイベントハンドラ
self.addEventListener('notificationclick', event => {
    console.log('SW Notification clicked:', event.notification);
    event.notification.close(); // 通知を閉じる

    const targetUrl = '/'; // タイマーページへのパス

     // クライアント（タブ）を探してフォーカス/開く
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // 既に開いているタブがあれば、それにフォーカスする
            for (const client of clientList) {
                 // URLが一致するかどうかで判断（より厳密なチェックも可能）
                 if (client.url.endsWith(targetUrl) && 'focus' in client) {
                     return client.focus();
                 }
            }
            // 開いているタブがなければ、新しいタブで開く
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );

     // 通知データに基づいてクライアントにメッセージを送るなども可能
     // const modeChangedTo = event.notification.data?.modeChangedTo;
     // clients.matchAll(...).then(clients => { clients.forEach(client => client.postMessage(...)); });
});