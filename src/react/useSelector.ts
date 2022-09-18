import { ObservablePrimitive, observe, setupTracking, symbolUndef, tracking } from '@legendapp/state';
import { useEffect, useReducer } from 'react';
import { computeSelector } from 'src/react/reactHelpers';

const Update = (s) => s + 1;

export function useSelector<T>(selector: ObservablePrimitive<T> | (() => T)): T {
    let inRun = true;

    let ret: T = symbolUndef as unknown as T;
    let cachedNodes;

    const fr = useReducer(Update, 0)[1];

    const update = function () {
        // If running, call selector and re-render if changed
        let cur = computeSelector(selector);
        // Re-render if not currently rendering and value has changed
        if (!inRun && cur !== ret) {
            fr();
        }
        ret = cur;
        inRun = false;

        // Workaround for React 18's double calling useEffect - cached the tracking nodes
        if (process.env.NODE_ENV === 'development') {
            cachedNodes = tracking.nodes;
        }
    };

    let dispose = observe(update);

    if (process.env.NODE_ENV === 'development') {
        useEffect(() => {
            // Workaround for React 18's double calling useEffect. If this is the
            // second useEffect, set up tracking again.
            if (dispose === undefined) {
                dispose = setupTracking(cachedNodes, update, /*noArgs*/ true);
            }
            return () => {
                dispose();
                dispose = undefined;
            };
        });
    } else {
        // Return dispose to cleanup before each render or on unmount
        useEffect(() => dispose);
    }

    return ret;
}
