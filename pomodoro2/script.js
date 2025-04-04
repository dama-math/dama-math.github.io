const timeLeftDisplay = document.getElementById('time-left');
const modeDisplay = document.getElementById('mode-display');
const startPauseButton = document.getElementById('start-pause-button');
const resetButton = document.getElementById('reset-button');
const workDurationInput = document.getElementById('work-duration');
const breakDurationInput = document.getElementById('break-duration');
const startSound = document.getElementById('start-sound');
const breakSound = document.getElementById('break-sound');
const canvas = document.getElementById('timer-canvas');
const ctx = canvas.getContext('2d');

let timerInterval = null;
let totalTime = parseInt(workDurationInput.value) * 60; // 初期値
let timeRemaining = totalTime;
let isPaused = true;
let isWorkMode = true; // true: 作業中, false: 休憩中
let endTime = null; // タイマー終了時刻のタイムスタンプ

// --- Service Worker 登録 ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(registration => {
            console.log('Service Worker 登録成功:', registration);
            // 必要に応じて通知許可を要求
             Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('通知許可が得られました');
                } else {
                    console.log('通知が拒否されました');
                }
            });
        })
        .catch(error => {
            console.log('Service Worker 登録失敗:', error);
        });
}

// --- タイマー関数 ---
function startTimer() {
    if (isPaused) {
        isPaused = false;
        startPauseButton.textContent = '一時停止';
        // endTime を現在時刻 + 残り時間で再計算
        endTime = Date.now() + timeRemaining * 1000;
        saveState(); // 開始時刻を含む状態を保存

         // 最初の開始時のみ音を鳴らす（モード変更時も）
        if (timeRemaining === totalTime) {
             playSound(isWorkMode ? startSound : breakSound);
             // バックグラウンド通知をスケジュール
            scheduleNotification(endTime);
        }


        timerInterval = setInterval(() => {
            const now = Date.now();
            // endTime から残り時間を計算
            timeRemaining = Math.round((endTime - now) / 1000);

            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                timeRemaining = 0; // 負の数にならないように
                updateDisplay(); // 00:00 を表示
                switchMode();
                // モード切り替え後に自動で次のタイマーを開始する場合
                // resetTimer(false); // 表示のみリセット
                // startTimer();
            } else {
                updateDisplay();
                saveState(); // 毎秒状態を保存（必要であれば間隔を調整）
            }
        }, 200); // 200ms ごとにチェックして表示のラグを減らす
    }
}

function pauseTimer() {
    if (!isPaused) {
        isPaused = true;
        startPauseButton.textContent = '再開';
        clearInterval(timerInterval);
        // 残り時間を endTime と現在時刻から再計算して保存
        timeRemaining = Math.round((endTime - Date.now()) / 1000);
        // endTime は未来の時刻のまま保持 or null にする（どちらでも良いが、復元ロジックと合わせる）
        saveState(); // 一時停止状態を保存
        // スケジュールされた通知をキャンセル（必要であれば）
        cancelScheduledNotification();
    }
}

function resetTimer(manualReset = true) {
    clearInterval(timerInterval);
    isPaused = true;
    isWorkMode = true; // リセット時は必ず作業モードから
    totalTime = parseInt(workDurationInput.value) * 60;
    timeRemaining = totalTime;
    endTime = null; // 終了時刻もリセット
    updateDisplay();
    startPauseButton.textContent = '開始';
    modeDisplay.textContent = '作業中';
    if (manualReset) {
        saveState(); // 手動リセット時も状態保存
        cancelScheduledNotification(); // 通知もキャンセル
    }
     // ドーナツグラフをリセット（100%表示）
    drawDonutChart(1);
}

function switchMode() {
    isWorkMode = !isWorkMode;
    modeDisplay.textContent = isWorkMode ? '作業中' : '休憩中';
    totalTime = (isWorkMode ? parseInt(workDurationInput.value) : parseInt(breakDurationInput.value)) * 60;
    timeRemaining = totalTime;
    endTime = null; // 新しいモードの終了時刻はまだ未定
    updateDisplay();
    playSound(isWorkMode ? startSound : breakSound);
    // saveState(); // 次のタイマーが開始される前に保存

    // 新しいモードの通知をスケジュール（自動開始する場合）
    // endTime = Date.now() + timeRemaining * 1000;
    // scheduleNotification(endTime);

     // モード切り替え時に自動で次のタイマーを開始したい場合は下のコメントを解除
    // isPaused = true; // startTimerを呼ぶために一時的に isPaused を true に
    // startTimer();
     // ドーナツグラフをリセット（100%表示）
    drawDonutChart(1);
}


// --- 表示更新 ---
function updateDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timeLeftDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const percentage = timeRemaining / totalTime;
    drawDonutChart(percentage);

    // タイトルにも残り時間を表示（オプション）
    document.title = `${timeLeftDisplay.textContent} - ${modeDisplay.textContent}`;
}

// --- ドーナツグラフ描画 ---
function drawDonutChart(percentage) {
    const radius = canvas.width / 2 - 10; // 外側の半径（線幅考慮）
    const lineWidth = 15; // ドーナツの線の太さ
    const innerRadius = radius - lineWidth; // 内側の半径
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const startAngle = -Math.PI / 2; // 12時の位置から開始
    const endAngle = startAngle + (2 * Math.PI * percentage);

    ctx.clearRect(0, 0, canvas.width, canvas.height); // キャンバスをクリア

    // 背景の円（暗い灰色）
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - lineWidth / 2, 0, 2 * Math.PI); // 線の中央を通るように半径調整
    /* ctx.strokeStyle = '#e0e0e0'; */ // 明るい色を削除
    ctx.strokeStyle = '#555555'; // 暗い背景色に変更
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // 残り時間の円弧
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - lineWidth / 2, startAngle, endAngle);
    /* ctx.strokeStyle = isWorkMode ? '#4CAF50' : '#2196F3'; */ // デフォルト色を削除
    // ダークテーマに合わせた色に変更
    ctx.strokeStyle = isWorkMode ? '#00bcd4' : '#ff9800'; // 作業中はティール、休憩中はオレンジ
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round'; //線の端を丸める
    ctx.stroke();
}

// --- 音声再生 ---
function playSound(audioElement) {
    audioElement.currentTime = 0; // 再生位置を最初に
     // play() はユーザー操作起因でないと失敗することがあるため try-catch
    try {
       const playPromise = audioElement.play();
       if (playPromise !== undefined) {
         playPromise.catch(error => {
           console.warn("音声の自動再生に失敗しました。ユーザー操作が必要です。", error);
           // 必要であれば、ユーザーにクリックを促すなどの表示を行う
         });
       }
     } catch (error) {
       console.error("音声再生エラー:", error);
     }
}

// --- 状態保存/復元 ---
function saveState() {
    const state = {
        timeRemaining: timeRemaining,
        isWorkMode: isWorkMode,
        isPaused: isPaused,
        workDuration: parseInt(workDurationInput.value),
        breakDuration: parseInt(breakDurationInput.value),
        endTime: endTime, // 終了時刻のタイムスタンプを保存
        totalTime: totalTime
    };
    localStorage.setItem('pomodoroState', JSON.stringify(state));
    // console.log('State saved:', state); // デバッグ用
}

function loadState() {
    const savedState = localStorage.getItem('pomodoroState');
    if (savedState) {
        const state = JSON.parse(savedState);
        // console.log('State loaded:', state); // デバッグ用

        isWorkMode = state.isWorkMode;
        workDurationInput.value = state.workDuration || 25;
        breakDurationInput.value = state.breakDuration || 5;
        totalTime = state.totalTime || (isWorkMode ? state.workDuration : state.breakDuration) * 60; // totalTimeも復元

        modeDisplay.textContent = isWorkMode ? '作業中' : '休憩中';

        if (state.isPaused === false && state.endTime) {
             // タイマーが動作中だった場合
             const now = Date.now();
             const remainingFromEnd = Math.round((state.endTime - now) / 1000);

             if (remainingFromEnd > 0) {
                 // まだ時間が残っている
                 timeRemaining = remainingFromEnd;
                 endTime = state.endTime; // 保存された終了時刻を使う
                 isPaused = false; // 状態を復元
                 startPauseButton.textContent = '一時停止';
                 updateDisplay();
                 // タイマーを再開する
                 startTimer(); // isPaused が false なので、内部の setInterval が始まる
             } else {
                 // 保存された終了時刻を過ぎている場合
                 // モードを切り替えて、次のタイマーの初期状態にする
                 // switchMode 内でリセットされるので、ここでは状態をクリアするだけで良いかも
                  console.log("復元時、タイマーは既に終了していました。モードを切り替えます。");
                  // switchMode を直接呼ぶと音声が鳴ってしまうため、手動で状態を設定
                   isWorkMode = !state.isWorkMode; // 元のモードの逆
                   totalTime = (isWorkMode ? parseInt(workDurationInput.value) : parseInt(breakDurationInput.value)) * 60;
                   timeRemaining = totalTime;
                   isPaused = true;
                   endTime = null;
                   modeDisplay.textContent = isWorkMode ? '作業中' : '休憩中';
                   startPauseButton.textContent = '開始';
                   updateDisplay();
                   saveState(); // 新しい初期状態を保存
             }

        } else {
            // タイマーが一時停止中だったか、初回起動の場合
            timeRemaining = state.timeRemaining !== undefined ? state.timeRemaining : parseInt(workDurationInput.value) * 60;
            isPaused = true;
            endTime = null; // 停止していたので終了時刻はリセット
             startPauseButton.textContent = '開始';
            updateDisplay();
        }

    } else {
        // 保存された状態がない場合（初回起動）
        resetTimer(false); // 初期状態に設定（保存はしない）
    }
     // 初期表示のためにグラフ描画
    drawDonutChart(timeRemaining / totalTime);
}


// --- バックグラウンド通知 ---
let notificationTimeoutId = null; // 通知用タイマーID

function scheduleNotification(timestamp) {
    cancelScheduledNotification(); // 既存の通知があればキャンセル

    if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator) || !navigator.serviceWorker.ready) {
        console.log("通知は利用できません。");
        // Service Workerが準備できていない場合はsetTimeoutでフォールバック
        const delay = timestamp - Date.now();
         if (delay > 0) {
            console.log(`Fallback setTimeout for notification in ${delay}ms`);
            notificationTimeoutId = setTimeout(() => {
                // ここで簡易的な通知を出す（タブが開いている場合のみ）
                 console.log("時間です！（Fallback）");
                // 必要なら alert など
            }, delay);
        }
        return;
    }


    const delay = timestamp - Date.now();
    if (delay > 0) {
        navigator.serviceWorker.ready.then(registration => {
            const title = isWorkMode ? '作業終了！' : '休憩終了！';
            const body = isWorkMode ? '休憩の時間です。' : '作業を再開しましょう！';
            const options = {
                body: body,
                icon: 'icon.png', // アイコン画像のパス
                tag: 'pomodoro-timer-notification', // 同じタグの通知は上書きされる
                data: { // 通知クリック時の動作に必要な情報など
                    modeChangedTo: isWorkMode ? 'break' : 'work'
                }
                // timestamp: timestamp // 通知が表示されるべき時間（オプション）
            };
            console.log(`Scheduling notification via SW: ${title} in ${delay}ms`);

            // Service Workerに通知のスケジュールを依頼
             registration.active.postMessage({
                 type: 'SCHEDULE_NOTIFICATION',
                 payload: { title, options, timestamp }
             });

             // フォールバック用のsetTimeoutも念のため保持（Service Workerが動かない場合用）
              notificationTimeoutId = setTimeout(() => {
                 console.log("Fallback timeout triggered (SW might have issues)");
             }, delay + 1000); // SWより少し遅れて発火させる

        }).catch(err => {
             console.error('Service Worker is not ready:', err);
             // Service Worker準備失敗時のフォールバック
             if (delay > 0) {
                 notificationTimeoutId = setTimeout(() => { console.log("時間です！（SW準備失敗 Fallback）"); }, delay);
             }
         });
    }
}

function cancelScheduledNotification() {
     // Service Worker 側のスケジュールキャンセルはpostMessageで指示できるが、
     // sw.js側で対応するメッセージハンドラが必要。今回は簡易的にクライアント側の clearTimeout のみ行う。
     // 同じtagで通知をスケジュールすれば上書きされるので、厳密なキャンセルは不要な場合も多い。
    if (notificationTimeoutId) {
        clearTimeout(notificationTimeoutId);
        notificationTimeoutId = null;
        console.log("Notification timeout cancelled.");
    }
     // Service Workerにキャンセルを伝える場合
     if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
         navigator.serviceWorker.ready.then(registration => {
             if (registration.active) {
                 registration.active.postMessage({ type: 'CANCEL_NOTIFICATION' });
                 console.log("Sent CANCEL_NOTIFICATION message to SW.");
             }
         });
     }
}


// --- イベントリスナー ---
startPauseButton.addEventListener('click', () => {
    // 音声再生の許可を得るためのユーザーインタラクション
    startSound.play().catch(()=>{}); // 無音で再生試行
    startSound.pause();
    breakSound.play().catch(()=>{});
    breakSound.pause();

    if (isPaused) {
        startTimer();
    } else {
        pauseTimer();
    }
});

resetButton.addEventListener('click', () => {
    resetTimer();
});

// 設定変更時にタイマーをリセット（オプション）
workDurationInput.addEventListener('change', () => {
    if (isPaused) { // タイマー動作中以外にリセット
         resetTimer();
    } else {
         // 動作中に変更された場合の挙動（例：アラートを出す、即時反映は複雑）
        alert("タイマー実行中に時間を変更する場合は、一度リセットしてください。");
        // 元の値に戻す
        workDurationInput.value = Math.floor(totalTime / 60) ; // isWorkModeに応じて戻す必要あり
    }

});
breakDurationInput.addEventListener('change', () => {
     if (isPaused) {
         // resetTimer(); // リセットするかどうかは仕様による
         // リセットしない場合、次の休憩から適用される
         // 保存だけしておく
         saveState();
     } else {
         alert("タイマー実行中に時間を変更する場合は、一度リセットしてください。");
         // 元の値に戻す
          breakDurationInput.value = Math.floor(totalTime / 60); // isWorkModeに応じて戻す必要あり
     }
});

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', () => {
    loadState(); // ページ読み込み時に状態を復元
    // 初期状態のグラフ描画（loadState内でも呼ばれるが念のため）
    if (timeRemaining !== undefined && totalTime !== undefined && totalTime > 0) {
       drawDonutChart(timeRemaining / totalTime);
   } else {
       drawDonutChart(1); // 初期状態は100%
   }
});

// ページが閉じられる/非表示になる直前に状態を保存
window.addEventListener('beforeunload', () => {
     if (!isPaused) {
          // 実行中の場合は、 pauseTimer と同様のロジックで残り時間を計算して保存
         timeRemaining = Math.round((endTime - Date.now()) / 1000);
     }
     saveState(); // 最新の状態を保存
});