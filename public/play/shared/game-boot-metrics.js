(function () {
    // Boot performance metrics collector
    var metrics = {};
    var marks = {};

    // Public API
    window.PirateArcadeMetrics = {
        mark: function (name) {
            var now = performance.now();
            marks[name] = now;
            metrics[name] = now;
            // Also store in window.__paBootMetrics for Playwright access
            if (!window.__paBootMetrics) {
                window.__paBootMetrics = {};
            }
            window.__paBootMetrics[name] = now;
        },
        measure: function (name, startMark, endMark) {
            var start = marks[startMark] || metrics[startMark] || 0;
            var end = marks[endMark] || metrics[endMark] || 0;
            if (start > 0 && end > 0) {
                var result = end - start;
                metrics[name] = result;
                if (window.__paBootMetrics) {
                    window.__paBootMetrics[name] = result;
                }
                return result;
            }
            return undefined;
        },
        get: function () {
            return Object.assign({}, metrics);
        },
        clear: function () {
            metrics = {};
            marks = {};
            if (window.__paBootMetrics) {
                window.__paBootMetrics = {};
            }
        }
    };

    // Initialize with page script start
    window.PirateArcadeMetrics.mark('page-script-start');

})();