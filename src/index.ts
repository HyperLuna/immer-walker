import type { Node as AnyNode } from 'estree'

interface Node {
  type: string
}

function isNode(node: object): node is Node {
  return 'type' in node && typeof node.type === 'string'
}

export const ENTER = Symbol('before visit node')
export const LEAVE = Symbol('after visit node')

export function make_walker<N extends Node>() {
  type Visitor<T extends Node, S> = (node: T, state: S, next: (state?: S) => T) => N | T | null

  type Visitors<S> = {
    [T in N as T['type']]?: Visitor<T, S>
  } & {
    [key: string]: unknown
    [ENTER]?: (node: Node, state: S) => S | undefined
    [LEAVE]?: (node: Node | null, state: S) => undefined
  }

  type BaseKey = N['type'] | typeof ENTER | typeof LEAVE
  type BaseV<S, V> = keyof V extends BaseKey ? Visitors<NoInfer<S>> : never

  return function <V extends BaseV<S, V>, S = undefined>(visitors: V, init_state?: S | (() => S)) {
    type VisitedType<T extends Node> = V[T['type']] extends (...args: never[]) => infer R ? R : T

    function new_state(): S {
      if (typeof init_state === 'function') {
        return (init_state as () => S)()
      }
      else {
        return init_state as S
      }
    }

    return function visit<T extends Node>(node: T, state = new_state()): VisitedType<T> {
      function next(next_state = state): T {
        const mutations = []

        for (const key in node) {
          if (node[key] && typeof node[key] === 'object') {
            if (Array.isArray(node[key])) {
              const array_mutations = []

              for (const [idx, nod] of node[key].entries()) {
                if (nod && typeof nod === 'object' && isNode(nod)) {
                  const result = visit(nod, next_state)

                  if (result !== nod) {
                    array_mutations.push([idx, result] as const)
                  }
                }
              }
              if (array_mutations.length) {
                const child = [...node[key]]

                for (const [idx, nod] of array_mutations) {
                  child[idx] = nod
                }
                mutations.push([key, child] as const)
              }
            }
            else if (isNode(node[key])) {
              const result = visit(node[key], next_state)

              if (result !== node[key]) {
                mutations.push([key, result] as const)
              }
            }
          }
        }
        if (mutations.length) {
          const new_node = { ...node }
          return Object.assign(new_node, Object.fromEntries(mutations))
        }
        else {
          return node
        }
      }

      if (visitors[ENTER]) {
        const enter_state = visitors[ENTER](node, state)
        if (enter_state !== undefined) {
          state = enter_state
        }
      }

      const visitor = visitors[node.type as T['type']] as Visitor<Node, S>
      const result = visitor ? visitor(node, state, next) : next()

      if (visitors[LEAVE]) {
        visitors[LEAVE](result, state)
      }

      return result as VisitedType<T>
    }
  }
}

export const walker = make_walker<AnyNode>()
