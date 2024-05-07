import { expectTypeOf } from 'expect-type';
import { Observable, ObservableBoolean, ObservableParam } from '../src/observableTypes';
import { observable } from '../src/observable';

describe('Types', () => {
    describe('observable', () => {
        it('optional object return type when no argument is passed', () => {
            function noArgsObjectType() {
                return observable<{ foo: number }>();
            }

            type ObservableFn = ReturnType<typeof noArgsObjectType>;
            expectTypeOf<ObservableFn['get']>().returns.toEqualTypeOf<{ foo: number } | undefined>();
        });

        it('optional return type when no argument is passed', () => {
            function noArgs() {
                return observable<string>();
            }

            type ObservableFn = ReturnType<typeof noArgs>;
            expectTypeOf<ObservableFn['get']>().returns.toEqualTypeOf<string | undefined>();
        });

        it('optional return type when optional argument is passed', () => {
            function withOptionalArg(something?: string) {
                return observable(something);
            }

            type ObservableFn = ReturnType<typeof withOptionalArg>;
            expectTypeOf<ObservableFn['get']>().returns.toEqualTypeOf<string | undefined>();
        });

        it('issue #151', () => {
            type ObservableFn = ReturnType<
                typeof observable<{
                    optional?: { foo: string };
                    nullable: { foo: string } | null;
                }>
            >;

            expectTypeOf<ObservableFn['get']>().returns.toEqualTypeOf<{
                optional?: { foo: string };
                nullable: { foo: string } | null;
            }>();

            // Note that if a parent is nullable, the child is optional (undefined)
            expectTypeOf<ObservableFn['nullable']['foo']['get']>().returns.toEqualTypeOf<string | undefined>();
            expectTypeOf<ObservableFn['optional']['foo']['get']>().returns.toEqualTypeOf<string | undefined>();
        });
    });

    describe('Observable', () => {
        describe('with any', () => {
            it('should infer any', () => {
                type GetState = Observable<any>['get'];
                expectTypeOf<GetState>().returns.toBeAny();
            });
            // it('should infer any children', () => {
            //     type State = Observable<any>;
            //     expectTypeOf<State['x']['get']>().returns.toBeAny();
            //     type B = State['x'];
            // });
        });
        describe('with state primitive', () => {
            it('should infer string', () => {
                type GetState = Observable<string>['get'];
                expectTypeOf<GetState>().returns.toBeString();
            });

            it('should infer number', () => {
                type GetState = Observable<number>['get'];
                expectTypeOf<GetState>().returns.toBeNumber();
            });

            it('should infer boolean', () => {
                type GetState = Observable<boolean>['get'];
                expectTypeOf<GetState>().returns.toBeBoolean();
            });

            it('should infer null', () => {
                type GetState = Observable<null>['get'];
                expectTypeOf<GetState>().returns.toBeNull();
            });

            it('should infer undefined', () => {
                type GetState = Observable<undefined>['get'];
                expectTypeOf<GetState>().returns.toBeUndefined();
            });
        });

        describe('with state object', () => {
            it('should infer object', () => {
                type State = Observable<{ foo: string }>;
                expectTypeOf<State['get']>().returns.toBeObject();
            });

            it('should infer record', () => {
                type State = Observable<Record<'x' | 'y', number>>;
                expectTypeOf<State>().toEqualTypeOf<Observable<{ x: number; y: number }>>();
                expectTypeOf<State['x']['get']>().returns.toBeNumber();
            });

            it('should infer record<string, number>', () => {
                type State = Observable<Record<string, number>>;
                expectTypeOf<State>().toEqualTypeOf<Observable<Record<string, number>>>();
                expectTypeOf<State['x']['get']>().returns.toBeNumber();
            });

            it('should infer record<string, any>', () => {
                type State = Observable<Record<string, any>>;
                expectTypeOf<State>().toEqualTypeOf<Observable<Record<string, any>>>();
                expectTypeOf<State['x']['get']>().returns.toBeAny();
            });

            describe('with nested nullable types', () => {
                it('should infer nested nullable value', () => {
                    type State = Observable<{ foo: { bar: string | null } }>;
                    expectTypeOf<State['foo']['bar']['get']>().returns.toEqualTypeOf<string | null>();
                });

                it('should infer nested optional value', () => {
                    type State = Observable<{ foo: { bar?: string } }>;
                    expectTypeOf<State['foo']['bar']['get']>().returns.toEqualTypeOf<string | undefined>();
                });

                it('should infer nested value as optional if parent is nullable', () => {
                    type State = Observable<{ foo: { bar: string } | null }>;
                    expectTypeOf<State['foo']['bar']['get']>().returns.toEqualTypeOf<string | undefined>();
                });

                it('should infer nested value as optional if parent is optional', () => {
                    type State = Observable<{ foo?: { bar: string } }>;
                    expectTypeOf<State['foo']['bar']['get']>().returns.toEqualTypeOf<string | undefined>();
                });

                it('should infer nested value as optional if their ancestors are optional and nullable', () => {
                    type State = Observable<{ foo?: { bar: { value: number } | null } }>;
                    expectTypeOf<State['foo']['bar']['value']['get']>().returns.toEqualTypeOf<number | undefined>();
                });

                it('should infer nullable value as both nullable and optional if parent is nullable', () => {
                    type State = Observable<{ foo: { bar?: string } | null }>;
                    expectTypeOf<State['foo']['bar']['get']>().returns.toEqualTypeOf<string | undefined>();
                });

                it('should infer nullable value as both nullable and optional if parent is optional', () => {
                    type State = Observable<{ foo?: { bar: string | null } }>;
                    expectTypeOf<State['foo']['bar']['get']>().returns.toEqualTypeOf<string | undefined | null>();
                });

                // TODO what happens if you have Observable<{ foo?: { bar: string, baz: number }} and obs$.foo.baz.set(12) ?
            });

            describe('with nested state primitive', () => {
                it('should infer string', () => {
                    type GetState = Observable<{ foo: string }>['foo']['get'];
                    expectTypeOf<GetState>().returns.toBeString();
                });

                it('should infer number', () => {
                    type GetState = Observable<{ foo: number }>['foo']['get'];
                    expectTypeOf<GetState>().returns.toBeNumber();
                });

                it('should infer boolean', () => {
                    type GetState = Observable<{ foo: boolean }>['foo']['get'];
                    expectTypeOf<GetState>().returns.toBeBoolean();
                });

                it('should infer date', () => {
                    type GetState = Observable<{ foo: Date }>['foo']['get'];
                    expectTypeOf<GetState>().returns.toEqualTypeOf<Date>();
                });

                it('should infer null', () => {
                    type GetState = Observable<{ foo: null }>['foo']['get'];
                    expectTypeOf<GetState>().returns.toBeNull();
                });

                it('should infer undefined', () => {
                    type GetState = Observable<{ foo: undefined }>['foo']['get'];
                    expectTypeOf<GetState>().returns.toBeUndefined();
                });
            });
        });

        describe('with array', () => {
            it('should infer array with object elements', () => {
                type State = Observable<{ foo: string }[]>;
                expectTypeOf<State['get']>().returns.toEqualTypeOf<{ foo: string }[]>();
                expectTypeOf<State>().toMatchTypeOf<Array<Observable<{ foo: string }>>>();
            });

            it('should infer array with primitive elements', () => {
                type State = Observable<string[]>;
                expectTypeOf<State['get']>().returns.toEqualTypeOf<string[]>();
                expectTypeOf<State[number]>().toEqualTypeOf<Observable<string>>();
                expectTypeOf<State>().toMatchTypeOf<Array<Observable<string>>>();
            });
        });

        describe('with function', () => {
            it('should infer function', () => {
                type State = Observable<{ foo: () => void }>;
                expectTypeOf<State['foo']>().toMatchTypeOf<() => void>();
            });

            it('should infer function as return type', () => {
                type State = Observable<{ foo: () => string }>;
                expectTypeOf<State['foo']>().toMatchTypeOf<Observable<string>>();
            });

            it('should infer nested function', () => {
                type State = Observable<{ foo: { bar: () => void } }>;
                expectTypeOf<State['foo']['bar']>().toMatchTypeOf<() => void>();
            });

            it('should make nested function optional if parent is optional', () => {
                type State = Observable<{ foo?: { bar: () => void } }>;
                expectTypeOf<State['foo']['bar']>().toEqualTypeOf<(() => void) | undefined>();
            });
        });

        it('should infer Map', () => {
            type GetState = Observable<Map<string, number>>['get'];
            expectTypeOf<GetState>().returns.toEqualTypeOf<Map<string, number>>();
        });

        describe('with maybe undefined', () => {
            it('with primitive', () => {
                type GetState = Observable<string | undefined>['get'];
                expectTypeOf<ReturnType<GetState>>().toEqualTypeOf<string | undefined>();
            });

            it('with object', () => {
                type GetState = Observable<{ foo: string } | undefined>['get'];
                expectTypeOf<ReturnType<GetState>>().toMatchTypeOf<{ foo: string } | undefined>();
            });

            it('with array', () => {
                type State = Observable<{ foo: string }[] | undefined>;
                expectTypeOf<State['get']>().returns.toEqualTypeOf<{ foo: string }[] | undefined>();
                expectTypeOf<State[number]>().toEqualTypeOf<Observable<{ foo: string } | undefined>>();
                expectTypeOf<State>().toMatchTypeOf<Array<Observable<{ foo: string } | undefined>>>();
            });

            it('with function', () => {
                type State = Observable<{ foo: () => void }>;
                expectTypeOf<State['foo']>().toEqualTypeOf<() => void>();
            });
        });

        describe('equality', () => {
            it('accepts subset', () => {
                interface Thing {
                    title: string;
                    id: string;
                    createdAt: Date;
                }

                function func(value$: Observable<{ id: string; title: string }>) {
                    return value$;
                }
                const obs = observable<Thing>({ id: '', title: '', createdAt: new Date() });
                func(obs);
            });
        });

        describe('discriminated union', () => {
            it('discrimiated union 1', () => {
                type Data = {};
                type State =
                    | { state: 'init' }
                    | { state: 'loading'; userId: number }
                    | { state: 'loaded'; userId: number; userData: Data };

                const state$ = observable<State>({ state: 'init' });
                state$.set({ state: 'loading', userId: 4 });
            });
        });

        describe('Observable parameters', () => {
            it('Observable string', () => {
                function tester(something: Observable<string>) {
                    expect(something.get()).toEqual(something.get());
                }

                tester(observable(''));
                tester(observable('Hello'));
                tester(observable<string>('Hello'));
            });
            it('Observable boolean', () => {
                function tester(something: Observable<boolean>) {
                    expect(something.get()).toEqual(something.get());
                }

                tester(observable(false));
                tester(observable(false) as ObservableBoolean);
                tester(observable(true));
                tester(observable<boolean>(true));
            });
            it('Observable object', () => {
                function tester(something: Observable<Record<string, boolean>>) {
                    expect(something.get()).toEqual(something.get());
                }

                //  tester(observable({ test: true}));
                tester(observable<Record<string, boolean>>({}));
                tester(observable<{ [x: string]: boolean }>({}));
                //  @ts-expect-error Should error
                tester(observable<{ [x: string]: string }>({}));
            });
            it('Observable any', () => {
                function tester(something: Observable<any>) {
                    expect(something.get()).toEqual(something.get());
                }

                //  tester(observable({ test: true}));
                tester(observable<Record<string, boolean>>({}));
                tester(observable<{ [x: string]: boolean }>({}));
                tester(observable<{ [x: string]: string }>({}));
                tester(observable<number>(10));
                tester(observable('hi'));
            });
            it('ObservableParam string', () => {
                function tester(something: ObservableParam<string>) {
                    expect(something.get()).toEqual(something.get());
                }

                tester(observable(''));
                tester(observable('Hello'));
                tester(observable<string>('Hello'));
            });
            it('ObservableParam boolean', () => {
                function tester(something: ObservableParam<boolean>) {
                    expect(something.get()).toEqual(something.get());
                }

                tester(observable(false));
                tester(observable(false) as ObservableBoolean);
                tester(observable(true));
                tester(observable<boolean>(true));
            });
            it('ObservableParam object', () => {
                function tester(something: ObservableParam<Record<string, boolean>>) {
                    expect(something.get()).toEqual(something.get());
                }

                //  tester(observable({ test: true}));
                tester(observable<Record<string, boolean>>({}));
                tester(observable<{ [x: string]: boolean }>({}));
                //  @ts-expect-error Should error
                tester(observable<{ [x: string]: string }>({}));
            });
            it('ObservableParam any', () => {
                function tester(something: ObservableParam<any>) {
                    expect(something.get()).toEqual(something.get());
                }

                //  tester(observable({ test: true}));
                tester(observable<Record<string, boolean>>({}));
                tester(observable<{ [x: string]: boolean }>({}));
                tester(observable<{ [x: string]: string }>({}));
                tester(observable<number>(10));
                tester(observable(false));
                tester(observable(false) as ObservableBoolean);
                tester(observable(true));
                tester(observable(''));
                tester(observable('Hello'));
                tester(observable<string>('Hello'));
                tester(observable<boolean>(true));
                tester(observable<Record<string, boolean>>({}));
                tester(observable<{ [x: string]: boolean }>({}));
            });
            it('ObservableParam template string', () => {
                function tester<T extends ObservableParam<string>>(something: T) {
                    expect(something.get()).toEqual(something.get());
                }

                tester(observable(''));
                tester(observable('Hello'));
                tester(observable<string>('Hello'));
            });
            it('ObservableParam template boolean', () => {
                function tester<T extends ObservableParam<boolean>>(something: T) {
                    expect(something.get()).toEqual(something.get());
                }

                tester(observable(false));
                tester(observable(false) as ObservableBoolean);
                tester(observable(true));
                tester(observable<boolean>(true));
            });
            it('ObservableParam template object', () => {
                function tester<T extends ObservableParam<Record<string, boolean>>>(something: T) {
                    expect(something.get()).toEqual(something.get());
                }

                //  tester(observable({ test: true}));
                tester(observable<Record<string, boolean>>({}));
                tester(observable<{ [x: string]: boolean }>({}));
                //  @ts-expect-error Should error
                tester(observable<{ [x: string]: string }>({}));
            });
            it('ObservableParam template string props object', () => {
                function tester<T>(something: { test: ObservableParam<T> }) {
                    expect(something.test.get()).toEqual(something.test.get());
                }

                tester({ test: observable('') });
                tester({ test: observable('Hello') });
                tester({ test: observable<string>('Hello') });
            });
            it('ObservableParam template any', () => {
                function tester<T extends ObservableParam<any>>(something: T) {
                    expect(something.get()).toEqual(something.get());
                }

                tester(observable(false));
                tester(observable(false) as ObservableBoolean);
                tester(observable(true));
                tester(observable(''));
                tester(observable('Hello'));
                tester(observable<string>('Hello'));
                tester(observable<boolean>(true));
                tester(observable<Record<string, boolean>>({}));
                tester(observable<{ [x: string]: boolean }>({}));
            });
        });
    });
});
