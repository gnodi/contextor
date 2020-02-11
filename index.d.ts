declare namespace contextor {
  interface Contextor {
    /**
     * Create a new context.
     * @returns {self}
     */
    create: () => this;
    /**
     * Set a value in the current context.
     * @param {string} key - The identifier key.
     * @param {*} value - The value.
     * @throws {ReferenceError} On missing current context.
     */
    set: (key: string, value: any) => this;
    /**
     * Get a value in the current context.
     * @param {string} key - The identifier key.
     * @param {*} defaultValue - The default value to return in case.
     * @param {boolean} allowUndefinedContext - Whether or not to allow undefined context,
     *                                          default false.
     * @returns {*} The value or default value for missing key.
     * @throws {ReferenceError} On missing value for given key in current context.
     */
    get: (key: string, defaultValue: any, allowUndefinedContext: boolean = false) => any;
  }
}

declare const contextor: contextor.Contextor;
export = contextor;
