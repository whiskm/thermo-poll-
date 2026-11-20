// Выполняет выражение JavaScript в WebView приложения через протокол отладки Chrome.
// Нужен проброс порта: adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>
const expr = process.argv[2];
const pages = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = pages.find((p) => p.type === 'page');
if (!page) {
  console.error('Страница WebView не найдена');
  process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
const timer = setTimeout(() => {
  console.error('Нет ответа от WebView');
  process.exit(1);
}, 15000);
ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }));
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id !== 1) return;
  clearTimeout(timer);
  console.log(String(d.result?.result?.value ?? d.result?.exceptionDetails?.text ?? ''));
  ws.close();
  process.exit(0);
};
