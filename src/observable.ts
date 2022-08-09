import { getChildNode, getNodeValue, symbolGet, symbolIsObservable } from './globals';
import { isArray, isFunction, isObject, isPrimitive, isSymbol } from './is';
import { observableBatcher, observableBatcherNotify } from './observableBatcher';
import {
    NodeValue,
    Observable,
    ObservableObjectOrPrimitive,
    ObservablePrimitive,
    ObservableWrapper,
} from './observableInterfaces';
import { onChange, onChangeShallow, onEquals, onHasValue, onTrue } from './on';
import { tracking, updateTracking } from './state';

let lastAccessedNode: NodeValue;
let lastAccessedPrimitive: string;
let inSetFn = false;
let didErrorOnMissingID = false;

const ArrayModifiers = new Set([
    'copyWithin',
    'fill',
    'from',
    'pop',
    'push',
    'reverse',
    'shift',
    'sort',
    'splice',
    'unshift',
]);
const ArrayLoopers = new Set<keyof Array<any>>(['every', 'some', 'filter', 'forEach', 'map']);

const objectFns = new Map<string, Function>([
    ['get', getNodeValue],
    ['set', set],
    ['onChange', onChange],
    ['onChangeShallow', onChangeShallow],
    ['onEquals', onEquals],
    ['onHasValue', onHasValue],
    ['onTrue', onTrue],
    ['prop', getProxy],
    ['assign', assign],
    ['delete', deleteFn],
]);

// Override primitives
const wrapFn = (fn: Function) =>
    function (...args: any) {
        if (lastAccessedNode && lastAccessedPrimitive) {
            const node: NodeValue = getChildNode(lastAccessedNode, lastAccessedPrimitive);
            if (getNodeValue(node) === this) {
                return fn(node, ...args);
            }
        }
    };

const toOverride = [Number, Boolean, String];
objectFns.forEach((fn, key) => {
    for (let i = 0; i < toOverride.length; i++) {
        toOverride[i].prototype[key] = wrapFn(fn);
    }
});

function collectionSetter(node: NodeValue, target: any, prop: string, ...args: any[]) {
    const prevValue = (isArray(target) && target.slice()) || target;

    const ret = (target[prop] as Function).apply(target, args);

    if (node) {
        const parent = node.parent;
        if (parent) {
            const parentValue = getNodeValue(parent);

            // Set the object to the previous value first
            parentValue[node.key] = prevValue;

            // Then set with the new value so it notifies with the correct prevValue
            setProp(parent, node.key, target);
        }
    }

    // Return the original value
    return ret;
}

function updateNodes(parent: NodeValue, obj: Record<any, any> | Array<any>, prevValue?: any) {
    const isArr = isArray(obj);
    // If array it's faster to just use the array
    const keys = isArr ? obj : Object.keys(obj);
    const length = keys.length;

    let hasADiff = false;
    let keyMap: Map<string | number, number>;
    let moved: Map<string | number, NodeValue>;

    if (isArr && prevValue?.length && isArray(prevValue)) {
        keyMap = new Map();
        moved = new Map();
        for (let i = 0; i < prevValue.length; i++) {
            keyMap.set(prevValue[i].id, i);
        }
    }

    for (let i = 0; i < length; i++) {
        const key = isArr ? i : keys[i];
        const value = obj[key];
        const prev = prevValue?.[key];

        if (prevValue && value !== prev) {
            const isObj = !isPrimitive(value);

            const child: NodeValue = getChildNode(parent, key);
            if (isArr && isObj && keyMap) {
                const id = value.id;
                if (id !== undefined) {
                    const prevIndex = keyMap.get(id);
                    if (prevIndex !== undefined && prevIndex !== i) {
                        let child: NodeValue = moved.get(prevIndex);
                        if (child) {
                            moved.delete(prevIndex);
                        } else {
                            child = getChildNode(parent, prevIndex);
                        }
                        moved.set(i, getChildNode(parent, i));
                        child.key = i;
                        parent.children.set(i, child);
                    }
                } else if (process.env.NODE_ENV === 'development' && !didErrorOnMissingID) {
                    console.error(
                        'Arrays in state containing objects must have a unique `id` field. See https://www.legendapp.com/dev/state/arrays'
                    );
                    didErrorOnMissingID = true;
                }
            }
            // If object iterate through its children
            if (isObj) {
                updateNodes(child, value, prev);
            }

            // Notify for this child if this element is different and it has listeners
            // But do not notify child if the parent is an array - the array's listener will cover it
            const doNotify = !!child.listeners;
            if (doNotify) {
                hasADiff = true;
                _notify(child, value, [], value, prev, 0);
            }
        }
    }

    return hasADiff;
}

function getProxy(node: NodeValue, p?: string | number) {
    // Create a proxy if not already cached and return it

    if (p !== undefined) node = getChildNode(node, p);
    let proxy = node.proxy;
    if (!proxy) {
        proxy = node.proxy = new Proxy<NodeValue>(node, proxyHandler);
    }
    return proxy;
}

const proxyHandler: ProxyHandler<any> = {
    get(target: NodeValue, p: any) {
        // Return true is called by isObservable()
        if (p === symbolIsObservable) {
            return true;
        }

        const node = target;
        const fn = objectFns.get(p);
        // If this is an observable function, call it
        if (p !== 'get' && fn) {
            return function (a, b, c) {
                const l = arguments.length;
                return l > 2 ? fn(node, a, b, c) : l > 1 ? fn(node, a, b) : fn(node, a);
            };
        }

        let value = getNodeValue(node);
        const vProp = value?.[p];
        // The get() function as well as the internal obs[symbolGet]
        if (p === symbolGet || p === 'get') {
            // Primitives are { current } so return the current value
            if (node.root.isPrimitive) {
                value = value.current;
            }
            // Update that this node was accessed for useObservables and useComputed
            if (tracking.is) {
                updateTracking(node, value);
            }
            return p === 'get' ? () => value : value;
        }
        // Accessing undefined/null/symbols passes straight through if this value has a property for it
        // If it's never been defined assume it's a proxy to a future object
        if (isSymbol(p) || vProp === null || (vProp === undefined && value && value.hasOwnProperty?.(p))) {
            return vProp;
        }
        // Handle function calls
        if (isFunction(vProp)) {
            if (isArray(value)) {
                if (ArrayModifiers.has(p)) {
                    // Call the wrapped modifier function
                    return (...args) => collectionSetter(node, value, p, ...args);
                } else if (ArrayLoopers.has(p)) {
                    return function (cbOrig, thisArg) {
                        function cb(value, index: number, array: any[]) {
                            return cbOrig(getProxy(node, index), index, array);
                        }
                        return value[p](cb, thisArg);
                    };
                }
            }
            // Return the function bound to the value
            return vProp.bind(value);
        }
        // Accessing primitives tracks and returns
        if (vProp !== undefined && isPrimitive(vProp)) {
            // Accessing a primitive saves the last accessed so that the observable functions
            // bound to primitives can know which node was accessed
            lastAccessedNode = node;
            lastAccessedPrimitive = p;
            // Update that this node was accessed for useObservables and useComputed
            if (tracking.is) {
                updateTracking(getChildNode(node, p), value);
            }
            return vProp;
        }

        return getProxy(target, p);
    },
    // Forward all proxy properties to the target's value
    getPrototypeOf(target) {
        const value = getNodeValue(target);
        return Reflect.getPrototypeOf(value);
    },
    ownKeys(target) {
        const value = getNodeValue(target);
        const keys = value ? Reflect.ownKeys(value) : [];
        if (isArray(value)) {
            if (keys[keys.length - 1] === 'length') {
                keys.splice(keys.length - 1, 1);
            }
        }
        return keys;
    },
    getOwnPropertyDescriptor(target, p) {
        const value = getNodeValue(target);
        return Reflect.getOwnPropertyDescriptor(value, p);
    },
    set(target, prop, value) {
        // If this assignment comes from within an observable function it's allowed
        if (inSetFn) {
            Reflect.set(target, prop, value);
            return true;
        } else {
            return false;
        }
    },
    deleteProperty(target, prop) {
        // If this delete comes from within an observable function it's allowed
        if (inSetFn) {
            Reflect.deleteProperty(target, prop);
            return true;
        } else {
            return false;
        }
    },
    has(target, prop) {
        const value = getNodeValue(target);
        return Reflect.has(value, prop);
    },
};

function set(node: NodeValue, keyOrNewValue: any, newValue?: any) {
    if (arguments.length > 2) {
        return setProp(node, keyOrNewValue, newValue);
    } else if (node.root.isPrimitive) {
        return setProp(node, 'current', keyOrNewValue);
    } else if (!node.parent) {
        return assign(node, keyOrNewValue);
    } else {
        return setProp(node.parent, node.key, keyOrNewValue);
    }
}

function setProp(node: NodeValue, key: string | number, newValue?: any, level?: number) {
    newValue =
        newValue && isObject(newValue) && newValue?.[symbolIsObservable as any] ? newValue[symbolGet as any] : newValue;

    const isPrim = isPrimitive(newValue);

    inSetFn = true;

    // Get the child node for updating and notifying
    const childNode = getChildNode(node, key);

    // Get the value of the parent
    let parentValue = getNodeValue(node);

    // Save the previous value first
    const prevValue = parentValue[key];

    // Save the new value
    parentValue[key] = newValue;

    let hasADiff: boolean;
    // If new value is an object or array update notify down the tree
    if (!isPrim) {
        hasADiff = updateNodes(childNode, newValue, prevValue);
    }

    // Notify for this element if it's an object or it's changed
    if (!isPrim || newValue !== prevValue) {
        notify(
            node.root.isPrimitive ? node : childNode,
            newValue,
            prevValue,
            level ?? prevValue === undefined ? -1 : 0
        );
    }

    inSetFn = false;

    return getProxy(node, key);
}

function createPreviousHandler(value: any, path: (string | number)[], prevAtPath: any) {
    // Create a function that clones the current state and injects the previous data at the changed path
    return function () {
        let clone = value ? JSON.parse(JSON.stringify(value)) : path.length > 0 ? {} : value;
        let o = clone;
        if (path.length > 0) {
            let i: number;
            for (i = 0; i < path.length - 1; i++) {
                o = o[path[i]];
            }
            o[path[i]] = prevAtPath;
        } else {
            clone = prevAtPath;
        }
        return clone;
    };
}

function _notify(
    node: NodeValue,
    value: any,
    path: (string | number)[],
    valueAtPath: any,
    prevAtPath: any,
    level: number
) {
    const listeners = node.listeners;
    if (listeners) {
        let getPrevious;
        for (let listener of listeners) {
            // Notify if listener is not shallow or if this is the first level
            if (!listener.shallow || level <= 0) {
                // Create a function to get the previous data. Computing a clone of previous data can be expensive if doing
                // it often, so leave it up to the caller.
                if (!getPrevious) {
                    getPrevious = createPreviousHandler(value, path, prevAtPath);
                }
                observableBatcherNotify({ cb: listener, value, getPrevious, path, valueAtPath, prevAtPath });
            }
        }
    }
}

function _notifyParents(
    node: NodeValue,
    value: any,
    path: (string | number)[],
    valueAtPath: any,
    prevAtPath: any,
    level: number
) {
    // Do the notify
    _notify(node, value, path, valueAtPath, prevAtPath, level);
    // If not root notify up through parents
    if (node.parent) {
        const parent = node.parent;
        if (parent) {
            const parentValue = getNodeValue(parent);
            _notifyParents(parent, parentValue, [node.key].concat(path), valueAtPath, prevAtPath, level + 1);
        }
    }
}
function notify(node: NodeValue, value: any, prev: any, level: number) {
    // Start notifying up through parents with the listenerInfo
    _notifyParents(node, value, [], value, prev, level);
}

function assign(node: NodeValue, value: any) {
    observableBatcher.begin();

    // Assign calls set with all assigned properties
    const keys = Object.keys(value);
    const length = keys.length;
    for (let i = 0; i < length; i++) {
        setProp(node, keys[i], value[keys[i]]);
    }

    const ret = getNodeValue(node);
    observableBatcher.end();

    return ret;
}

function deleteFn(node: NodeValue, key?: string | number) {
    // If called without a key, delete by key from the parent node
    if (key !== undefined) {
        return deleteFnByKey(node, key);
    } else if (node.parent) {
        return deleteFnByKey(node.parent, node.key);
    }
}
function deleteFnByKey(node: NodeValue, key: string | number) {
    if (!node.root.isPrimitive) {
        // delete sets to undefined first to notify
        setProp(node, key, undefined, /*level*/ -1);
    }

    inSetFn = true;
    // Then delete the key from the object
    let child = getNodeValue(node);
    delete child[key];

    inSetFn = false;
}

export function observable<T extends object>(obj: T): ObservableObjectOrPrimitive<T>;
export function observable<T extends boolean>(prim: T): ObservablePrimitive<boolean>;
export function observable<T extends string>(prim: T): ObservablePrimitive<string>;
export function observable<T extends number>(prim: T): ObservablePrimitive<number>;
export function observable<T extends boolean | string | number>(prim: T): ObservablePrimitive<T>;
export function observable<T>(obj: T): ObservableObjectOrPrimitive<T> {
    const isPrim = isPrimitive(obj);
    // Primitives wrap in current
    if (isPrim) {
        obj = { current: obj } as any;
    }

    const obs = {
        _: obj as Observable<T>,
        isPrimitive: isPrim,
        listenerMap: new Map(),
        proxies: new Map(),
        NodeValues: new Map(),
    } as ObservableWrapper;

    const node: NodeValue = {
        root: obs,
        parent: undefined,
        key: undefined,
    };

    return getProxy(node) as ObservableObjectOrPrimitive<T>;
}
