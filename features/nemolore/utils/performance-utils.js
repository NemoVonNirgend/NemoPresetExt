/**
 * Performance Utilities
 * RECOVERY VERSION - Performance monitoring and optimization utilities
 */

/**
 * Performance monitoring and timing utilities
 */
export class PerformanceUtils {
    constructor() {
        this.metrics = new Map();
        this.timers = new Map();
        this.counters = new Map();
        this.isMonitoringEnabled = true;
        
        // Performance thresholds
        this.thresholds = {
            slow: 1000,     // 1 second
            warning: 2000,  // 2 seconds
            critical: 5000  // 5 seconds
        };
        
        // Memory monitoring
        this.memorySnapshots = [];
        this.maxSnapshots = 100;
        
        console.log('[NemoLore Performance Utils] Constructor completed');
    }

    /**
     * Start timing an operation
     */
    startTimer(name) {
        if (!this.isMonitoringEnabled) return null;
        
        const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.timers.set(timerId, {
            name: name,
            startTime: performance.now(),
            startMemory: this.getMemoryUsage()
        });
        
        return timerId;
    }

    /**
     * End timing an operation
     */
    endTimer(timerId) {
        if (!this.isMonitoringEnabled || !timerId) return null;
        
        const timer = this.timers.get(timerId);
        if (!timer) return null;
        
        const endTime = performance.now();
        const endMemory = this.getMemoryUsage();
        const duration = endTime - timer.startTime;
        
        const metric = {
            name: timer.name,
            duration: duration,
            startTime: timer.startTime,
            endTime: endTime,
            memoryDelta: endMemory - timer.startMemory,
            timestamp: Date.now(),
            level: this.getPerformanceLevel(duration)
        };
        
        // Store metric
        this.addMetric(metric);
        
        // Clean up timer
        this.timers.delete(timerId);
        
        return metric;
    }

    /**
     * Time a function execution
     */
    async timeFunction(name, fn, context = null) {
        if (!this.isMonitoringEnabled) {
            return context ? fn.call(context) : fn();
        }
        
        const timerId = this.startTimer(name);
        
        try {
            const result = context ? await fn.call(context) : await fn();
            const metric = this.endTimer(timerId);
            
            return {
                result: result,
                metric: metric
            };
        } catch (error) {
            this.endTimer(timerId);
            this.recordError(name, error);
            throw error;
        }
    }

    /**
     * Time a synchronous function
     */
    timeFunctionSync(name, fn, context = null) {
        if (!this.isMonitoringEnabled) {
            return context ? fn.call(context) : fn();
        }
        
        const timerId = this.startTimer(name);
        
        try {
            const result = context ? fn.call(context) : fn();
            const metric = this.endTimer(timerId);
            
            return {
                result: result,
                metric: metric
            };
        } catch (error) {
            this.endTimer(timerId);
            this.recordError(name, error);
            throw error;
        }
    }

    /**
     * Add a metric
     */
    addMetric(metric) {
        const key = metric.name;
        
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        
        const metrics = this.metrics.get(key);
        metrics.push(metric);
        
        // Limit stored metrics to prevent memory issues
        if (metrics.length > 1000) {
            metrics.splice(0, metrics.length - 1000);
        }
        
        // Log warnings for slow operations
        if (metric.level === 'warning' || metric.level === 'critical') {
            console.warn(`[NemoLore Performance] ${metric.level.toUpperCase()}: ${metric.name} took ${metric.duration.toFixed(2)}ms`);
        }
    }

    /**
     * Get performance level based on duration
     */
    getPerformanceLevel(duration) {
        if (duration >= this.thresholds.critical) {
            return 'critical';
        } else if (duration >= this.thresholds.warning) {
            return 'warning';
        } else if (duration >= this.thresholds.slow) {
            return 'slow';
        } else {
            return 'normal';
        }
    }

    /**
     * Increment a counter
     */
    incrementCounter(name, value = 1) {
        if (!this.isMonitoringEnabled) return;
        
        const currentValue = this.counters.get(name) || 0;
        this.counters.set(name, currentValue + value);
    }

    /**
     * Get counter value
     */
    getCounter(name) {
        return this.counters.get(name) || 0;
    }

    /**
     * Reset counter
     */
    resetCounter(name) {
        this.counters.delete(name);
    }

    /**
     * Get current memory usage
     */
    getMemoryUsage() {
        if (performance.memory) {
            return performance.memory.usedJSHeapSize;
        }
        return 0;
    }

    /**
     * Take memory snapshot
     */
    takeMemorySnapshot(label = '') {
        const snapshot = {
            label: label,
            timestamp: Date.now(),
            memory: this.getMemoryUsage()
        };
        
        this.memorySnapshots.push(snapshot);
        
        // Limit snapshots
        if (this.memorySnapshots.length > this.maxSnapshots) {
            this.memorySnapshots.shift();
        }
        
        return snapshot;
    }

    /**
     * Get memory statistics
     */
    getMemoryStats() {
        if (this.memorySnapshots.length === 0) {
            return null;
        }
        
        const memories = this.memorySnapshots.map(s => s.memory);
        const current = memories[memories.length - 1];
        const min = Math.min(...memories);
        const max = Math.max(...memories);
        const avg = memories.reduce((sum, mem) => sum + mem, 0) / memories.length;
        
        return {
            current: current,
            min: min,
            max: max,
            average: avg,
            growth: memories.length > 1 ? current - memories[0] : 0,
            snapshots: this.memorySnapshots.length
        };
    }

    /**
     * Record an error
     */
    recordError(operation, error) {
        const errorMetric = {
            name: `${operation}_error`,
            error: error.message || error.toString(),
            stack: error.stack,
            timestamp: Date.now(),
            level: 'error'
        };
        
        this.addMetric(errorMetric);
        this.incrementCounter('errors_total');
        this.incrementCounter(`errors_${operation}`);
    }

    /**
     * Get metrics for a specific operation
     */
    getMetrics(name) {
        return this.metrics.get(name) || [];
    }

    /**
     * Get all metrics
     */
    getAllMetrics() {
        const result = {};
        for (const [name, metrics] of this.metrics.entries()) {
            result[name] = [...metrics];
        }
        return result;
    }

    /**
     * Get performance statistics
     */
    getStats(name = null) {
        if (name) {
            return this.getOperationStats(name);
        } else {
            return this.getOverallStats();
        }
    }

    /**
     * Get statistics for a specific operation
     */
    getOperationStats(name) {
        const metrics = this.getMetrics(name);
        
        if (metrics.length === 0) {
            return {
                name: name,
                count: 0,
                totalDuration: 0,
                averageDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                errorCount: 0
            };
        }
        
        const durations = metrics
            .filter(m => m.duration !== undefined)
            .map(m => m.duration);
        
        const errors = metrics.filter(m => m.level === 'error');
        
        return {
            name: name,
            count: durations.length,
            totalDuration: durations.reduce((sum, d) => sum + d, 0),
            averageDuration: durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
            minDuration: durations.length > 0 ? Math.min(...durations) : 0,
            maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
            errorCount: errors.length,
            lastExecution: metrics[metrics.length - 1]?.timestamp || 0
        };
    }

    /**
     * Get overall performance statistics
     */
    getOverallStats() {
        const allOperations = Array.from(this.metrics.keys());
        const operationStats = {};
        
        let totalOperations = 0;
        let totalDuration = 0;
        let totalErrors = 0;
        
        for (const operation of allOperations) {
            if (operation.endsWith('_error')) continue;
            
            const stats = this.getOperationStats(operation);
            operationStats[operation] = stats;
            
            totalOperations += stats.count;
            totalDuration += stats.totalDuration;
            totalErrors += stats.errorCount;
        }
        
        return {
            totalOperations: totalOperations,
            totalDuration: totalDuration,
            averageDuration: totalOperations > 0 ? totalDuration / totalOperations : 0,
            totalErrors: totalErrors,
            operationCount: allOperations.length,
            operations: operationStats,
            counters: Object.fromEntries(this.counters),
            memory: this.getMemoryStats(),
            activeTimers: this.timers.size
        };
    }

    /**
     * Get slow operations
     */
    getSlowOperations(limit = 10) {
        const allMetrics = [];
        
        for (const [name, metrics] of this.metrics.entries()) {
            for (const metric of metrics) {
                if (metric.duration && metric.duration >= this.thresholds.slow) {
                    allMetrics.push(metric);
                }
            }
        }
        
        return allMetrics
            .sort((a, b) => b.duration - a.duration)
            .slice(0, limit);
    }

    /**
     * Get recent errors
     */
    getRecentErrors(limit = 10) {
        const errors = [];
        
        for (const [name, metrics] of this.metrics.entries()) {
            for (const metric of metrics) {
                if (metric.level === 'error') {
                    errors.push(metric);
                }
            }
        }
        
        return errors
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    /**
     * Clear all metrics
     */
    clearMetrics() {
        this.metrics.clear();
        this.counters.clear();
        this.memorySnapshots = [];
    }

    /**
     * Clear metrics for specific operation
     */
    clearOperationMetrics(name) {
        this.metrics.delete(name);
        this.metrics.delete(`${name}_error`);
        
        // Clear related counters
        const keysToDelete = [];
        for (const key of this.counters.keys()) {
            if (key.includes(name)) {
                keysToDelete.push(key);
            }
        }
        
        for (const key of keysToDelete) {
            this.counters.delete(key);
        }
    }

    /**
     * Enable/disable monitoring
     */
    setMonitoringEnabled(enabled) {
        this.isMonitoringEnabled = enabled;
        
        if (!enabled) {
            // Clear active timers
            this.timers.clear();
        }
    }

    /**
     * Set performance thresholds
     */
    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * Export performance data
     */
    exportData() {
        return {
            metrics: this.getAllMetrics(),
            counters: Object.fromEntries(this.counters),
            memorySnapshots: this.memorySnapshots,
            thresholds: this.thresholds,
            isMonitoringEnabled: this.isMonitoringEnabled,
            exportedAt: Date.now()
        };
    }

    /**
     * Import performance data
     */
    importData(data) {
        if (data.metrics) {
            this.metrics.clear();
            for (const [name, metrics] of Object.entries(data.metrics)) {
                this.metrics.set(name, metrics);
            }
        }
        
        if (data.counters) {
            this.counters.clear();
            for (const [name, value] of Object.entries(data.counters)) {
                this.counters.set(name, value);
            }
        }
        
        if (data.memorySnapshots) {
            this.memorySnapshots = [...data.memorySnapshots];
        }
        
        if (data.thresholds) {
            this.thresholds = { ...data.thresholds };
        }
        
        if (data.isMonitoringEnabled !== undefined) {
            this.isMonitoringEnabled = data.isMonitoringEnabled;
        }
    }

    /**
     * Create performance report
     */
    createReport() {
        const stats = this.getOverallStats();
        const slowOps = this.getSlowOperations(5);
        const recentErrors = this.getRecentErrors(5);
        const memStats = this.getMemoryStats();
        
        const report = {
            timestamp: Date.now(),
            summary: {
                totalOperations: stats.totalOperations,
                averageDuration: Math.round(stats.averageDuration * 100) / 100,
                totalErrors: stats.totalErrors,
                errorRate: stats.totalOperations > 0 ? (stats.totalErrors / stats.totalOperations * 100).toFixed(2) : 0,
                slowOperationsCount: slowOps.length
            },
            performance: {
                slowOperations: slowOps.map(op => ({
                    name: op.name,
                    duration: Math.round(op.duration * 100) / 100,
                    timestamp: op.timestamp
                })),
                operationStats: Object.fromEntries(
                    Object.entries(stats.operations)
                        .sort(([,a], [,b]) => b.averageDuration - a.averageDuration)
                        .slice(0, 10)
                        .map(([name, data]) => [name, {
                            count: data.count,
                            avgDuration: Math.round(data.averageDuration * 100) / 100,
                            maxDuration: Math.round(data.maxDuration * 100) / 100,
                            errorCount: data.errorCount
                        }])
                )
            },
            errors: {
                recent: recentErrors.map(err => ({
                    operation: err.name,
                    error: err.error,
                    timestamp: err.timestamp
                })),
                counters: Object.fromEntries(
                    Array.from(this.counters.entries())
                        .filter(([key]) => key.startsWith('errors_'))
                )
            },
            memory: memStats ? {
                current: Math.round(memStats.current / 1024 / 1024 * 100) / 100, // MB
                max: Math.round(memStats.max / 1024 / 1024 * 100) / 100,
                average: Math.round(memStats.average / 1024 / 1024 * 100) / 100,
                growth: Math.round(memStats.growth / 1024 / 1024 * 100) / 100
            } : null
        };
        
        return report;
    }
}

// Export singleton instance
export const performanceUtils = new PerformanceUtils();

// Convenience functions
export function startTimer(name) {
    return performanceUtils.startTimer(name);
}

export function endTimer(timerId) {
    return performanceUtils.endTimer(timerId);
}

export async function timeFunction(name, fn, context = null) {
    return performanceUtils.timeFunction(name, fn, context);
}

export function timeFunctionSync(name, fn, context = null) {
    return performanceUtils.timeFunctionSync(name, fn, context);
}

export function incrementCounter(name, value = 1) {
    return performanceUtils.incrementCounter(name, value);
}

export function getStats(name = null) {
    return performanceUtils.getStats(name);
}

export function createReport() {
    return performanceUtils.createReport();
}

console.log('[NemoLore Performance Utils] Module loaded - Performance monitoring ready');