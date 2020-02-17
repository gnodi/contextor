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
     * @param {boolean} allowUndefinedContext - Whether or not to allow undefined context.
     * @returns {*} The value or default value for missing key.
     * @throws {ReferenceError} On missing value for given key in current context.
     */
    get: (key: string, defaultValue: any, allowUndefinedContext?: boolean) => any;
    /**
     * Get an object describing memory usage of the contextor and process
     * in order to help debugging potential memory leaks.
     * @returns {object} Memory usage description.
     */
    getMemoryUsage: () => object;
  }
}

declare const contextor: contextor.Contextor;
export = contextor;
