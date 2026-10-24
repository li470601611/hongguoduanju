// ==UserScript==
// @name         红果短剧网页端自动连播（提前0.5秒切集版）
// @namespace    https://github.com/li470601611
// @version      1.1.2
// @description  红果短剧网页端自动连播，结束前0.5秒提前切集，避开二维码弹窗。第一次用放代码到github，有ai可以做的事情真的很多
// @author       原作者庙竹 (miaozhu) 【联系不到作者，用豆包微调】
// @license      MIT
// @match        *://hongguoduanju.com/player/*
// @match        *://*.hongguoduanju.com/player/*
// @updateURL    https://raw.githubusercontent.com/li470601611/hongguoduanju/main/hongguoduanju.user.js
// @downloadURL  https://raw.githubusercontent.com/li470601611/hongguoduanju/main/hongguoduanju.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[红果短剧自动连播] 脚本已启动 - 提前0.5秒切集版');

    let isSwitching = false;

    // 核心切换下一集逻辑
    function playNextEpisode() {
        if (isSwitching) return;
        isSwitching = true;

        console.log('[红果短剧自动连播] 正在切换下一集...');

        // 策略1：优先点击播放器控制栏内置的“下一集”控件
        const nextBtn = document.querySelector('.xgplayer-pc-next');
        if (nextBtn) {
            console.log('[红果短剧自动连播] 触发播放器下一集按钮');
            nextBtn.click();
            resetSwitchingLock();
            return;
        }

        // 策略2：从右侧选集列表中查找当前活跃集并点击下一个兄弟节点
        const activeEpisode = document.querySelector('.pc-episode-active-g9bzJq') || document.querySelector('.pc-episode-UHokP2.active');
        if (activeEpisode && activeEpisode.nextElementSibling) {
            console.log('[红果短剧自动连播] 点击选集列表下一集');
            activeEpisode.nextElementSibling.click();
            resetSwitchingLock();
            return;
        }

        // 策略3：针对跨页/分页情况，计算全部集数索引进行跳转
        const allEpisodes = Array.from(document.querySelectorAll('.pc-episodes-f2TrcE a.pc-episode-UHokP2'));
        const currentIndex = allEpisodes.findIndex(el => el.classList.contains('pc-episode-active-g9bzJq'));
        if (currentIndex !== -1 && currentIndex + 1 < allEpisodes.length) {
            console.log(`[红果短剧自动连播] 切换至第 ${currentIndex + 2} 集`);
            allEpisodes[currentIndex + 1].click();
            resetSwitchingLock();
            return;
        }

        console.warn('[红果短剧自动连播] 未找到下一集，可能是最后一集或已达试看限制');
        resetSwitchingLock();
    }

    // 防抖与重置锁定
    function resetSwitchingLock() {
        setTimeout(() => {
            isSwitching = false;
        }, 1500);
    }

    // 尝试确保新视频自动开始播放
    function ensurePlay(video) {
        if (!video || !video.paused) return;

        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch((err) => {
                console.warn('[红果短剧自动连播] 浏览器后台拦截了播放，尝试静音唤起播放', err);
                video.muted = true;
                video.play().catch(e => console.error('[红果短剧自动连播] 自动播放失败:', e));
            });
        }
    }

    // 绑定视频事件
    function bindVideoEvents() {
        const video = document.querySelector('video');
        if (!video) return;

        // 防止重复绑定
        if (video.dataset.autoNextBound) return;
        video.dataset.autoNextBound = 'true';

        console.log('[红果短剧自动连播] 成功绑定视频事件监听');

        // ✅ 提前0.5秒触发下一集，避免弹出二维码
        let hasTriggeredNext = false;
        video.addEventListener('timeupdate', () => {
            if (hasTriggeredNext || isSwitching) return;
            const remaining = video.duration - video.currentTime;
            // 剩余时间 <= 0.5秒时切集，可调整提前量
            if (remaining <= 0.5 && video.duration > 0) {
                hasTriggeredNext = true;
                console.log('[红果短剧自动连播] 剩余0.5秒，提前切换下一集');
                playNextEpisode();
            }
        });

        // 每切换到新一集，自动重置触发标记
        video.addEventListener('loadedmetadata', () => {
            hasTriggeredNext = false;
        });

        // 当视频就绪时尝试播放（配合切集）
        video.addEventListener('canplay', () => {
            ensurePlay(video);
        });
    }

    // 页面 DOM 观察器，应对单页应用(SPA)路由变化与动态节点更新
    const observer = new MutationObserver(() => {
        bindVideoEvents();

        // 兜底：监测播放结束遮罩层，提前切失败了也能补一刀
        const endedMask = document.querySelector('.pc-ended-CAMd6t');
        if (endedMask && !endedMask.dataset.handled) {
            endedMask.dataset.handled = 'true';
            setTimeout(playNextEpisode, 500);
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 初次加载尝试绑定
    bindVideoEvents();
})();
