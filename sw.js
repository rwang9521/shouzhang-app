const CACHE_NAME = 'shouzhang-app-v5';
const ASSETS = [
  'index.html',
  'manifest.webmanifest',
  'icon-512.png'
];

// 安装时强行跳过等待，让新 Service Worker 立即生效
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 仅缓存本地绝对安全的基础资产
      return cache.addAll(ASSETS);
    })
  );
});

// 激活时自动清理所有旧版本的、或者损坏的缓存垃圾
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // 立即接管所有页面
  );
});

// 核心稳定算法：【网络优先】策略
// 每次打开优先走手机网络去加载最新代码，如果网络挂了/或者没信号，才无缝切换到手机本地缓存
self.addEventListener('fetch', event => {
  // 对第三方外部 CDN 链接（如 Chart.js）不强行进行本地文件拦截，防止其死锁
  if (!event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 如果网络请求成功，把新版本动态更新到缓存里
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // 只有当断网、或者网络极差超时的时候，才去读取本地缓存，确保百分之百能打开
        return caches.match(event.request);
      })
  );
});
