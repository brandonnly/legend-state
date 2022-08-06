import { tracking } from './state';
import { isFunction, isPrimitive } from './is';
import { ObservableCheckerRender, ProxyValue } from './observableInterfaces';

export const delim = '\uFEFF';

export const symbolDateModified = Symbol('dateModified');
export const symbolShallow = Symbol('shallow');
export const symbolShouldRender = Symbol('shouldRender');
export const symbolGet = Symbol('get');
export const symbolIsObservable = Symbol('isObservable');

export function getNodeValue(node: ProxyValue): any {
    const arr: (string | number)[] = [];
    let n = node;
    while (n?.key !== undefined) {
        arr.push(n.key);
        n = n.parent;
    }
    let child = node.root._;
    for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i] !== undefined && child) {
            child = child[arr[i]];
        }
    }
    return child;
    // let child = node.root;
    // const arr = node.path.split(delim);
    // for (let i = 0; i < arr.length; i++) {
    //     if (arr[i] !== undefined && child) {
    //         child = child[arr[i]];
    //     }
    // }
    // return child;
}

// export function getParentNode(node: ProxyValue): { parent: ProxyValue; key: string | number } {
//     if (node.path === '_') return { parent: node, key: undefined };
//     const parent = node.root.proxyValues.get(node.pathParent);
//     return { parent, key: node.key };
// }

export function getChildNode(node: ProxyValue, key: string | number): ProxyValue {
    if (!isNaN(+key)) key = +key;
    let child = node.children?.get(key);
    if (!child) {
        child = {
            root: node.root,
            parent: node,
            // path: node.path + delim + key,
            // arr: node.arr.concat(key),
            // arrParent: node.arr,
            // pathParent: node.path,
            key,
        };
        if (!node.children) {
            node.children = new Map();
        }
        node.children.set(key, child);
        //     node.root.proxyValues.set(path, child);
    }
    // const path = node.path + delim + key;
    // let child = node.root.proxyValues.get(path);
    // if (!child) {
    //     // console.log('creating child', node.path, key);
    //     child = {
    //         root: node.root,
    //         path: node.path + delim + key,
    //         // arr: node.arr.concat(key),
    //         // arrParent: node.arr,
    //         pathParent: node.path,
    //         key,
    //     };
    //     node.root.proxyValues.set(path, child);
    // }

    return child;
}

export function getObservableRawValue<T>(obs: ObservableCheckerRender<T>): T {
    if (!obs || isPrimitive(obs)) return obs as T;
    if (isFunction(obs)) return obs();

    const shallow = obs?.[symbolShallow];
    if (shallow) {
        tracking.shallow = true;
        obs = shallow;
    }
    let ret = obs?.[symbolGet];

    tracking.should = undefined;
    tracking.shallow = false;

    return ret;
}
