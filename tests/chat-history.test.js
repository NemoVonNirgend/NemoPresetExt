import assert from 'node:assert/strict';
import test from 'node:test';
import { attachHistoryScroll } from '../features/chat-history/controller.js';

function setup({ limit = 5, pending = Promise.resolve() } = {}) {
    const frames = new Map();
    let nextFrame = 0;
    let now = 100;
    const scroller = new EventTarget();
    const anchor = {
        parentElement: scroller,
        top: 100,
        getBoundingClientRect() { return { top: this.top }; },
    };
    const calls = [];
    const view = {
        requestAnimationFrame(callback) {
            frames.set(nextFrame, callback);
            return nextFrame++;
        },
        cancelAnimationFrame(frame) { frames.delete(frame); },
        performance: { now: () => now },
    };
    Object.assign(scroller, {
        ownerDocument: { defaultView: view },
        scrollTop: 0,
        button: {},
        querySelector(selector) {
            return selector.includes('#show_more_messages') ? this.button : anchor;
        },
    });
    const stop = attachHistoryScroll({
        scroller,
        showMoreMessages(count) {
            calls.push(count);
            anchor.top += 17;
            return pending;
        },
        pageSize: () => limit,
        onError: assert.ifError,
    });

    return {
        scroller,
        calls,
        stop,
        flush(time = 0) {
            now += time;
            for (const [id, run] of frames) {
                frames.delete(id);
                run();
            }
        },
        wheel(deltaY) {
            scroller.dispatchEvent(Object.assign(new Event('wheel'), { deltaX: 0, deltaY }));
        },
    };
}

test('loads once at the top after upward input and keeps the old message anchored', async () => {
    let complete;
    const pending = new Promise(resolve => { complete = resolve; });
    const { scroller, calls, stop, wheel, flush } = setup({ pending });
    scroller.scrollTop = 120;
    wheel(-80);
    flush();
    assert.deepEqual(calls, []);
    scroller.scrollTop = 15;
    scroller.dispatchEvent(new Event('scroll'));
    flush();
    assert.deepEqual(calls, [5]);
    assert.equal(scroller.scrollTop, 32);

    scroller.scrollTop = 0;
    wheel(-80);
    flush();
    assert.deepEqual(calls, [5]);
    complete();
    await pending;
    wheel(-80);
    flush();
    assert.deepEqual(calls, [5, 5]);
    stop();
});

test('ignores expired input, chat switches, manual paging and pending input after disable', () => {
    const { scroller, calls, stop, wheel, flush } = setup();
    scroller.dispatchEvent(new Event('scroll'));
    flush();
    wheel(-80);
    flush(600);
    wheel(-80);
    scroller.button = {};
    flush();
    wheel(-80);
    scroller.dispatchEvent(new Event('click'));
    flush();
    wheel(-80);
    stop();
    flush();
    wheel(-80);
    flush();
    assert.deepEqual(calls, []);
});

test('a zero message limit or the absence of the native control leaves the chat alone', () => {
    const unlimited = setup({ limit: 0 });
    unlimited.wheel(-80);
    unlimited.flush();
    assert.deepEqual(unlimited.calls, []);
    unlimited.stop();

    const complete = setup();
    complete.scroller.button = null;
    complete.wheel(-80);
    complete.flush();
    assert.deepEqual(complete.calls, []);
    complete.stop();
});
