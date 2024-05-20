
export class Concurrencer {
    private pendingPromise: Promise<any>[] = [];
    private resultPromise: any[] = [];

    add(promise: Promise<any>): number {
        return this.pendingPromise.push(promise) - 1;
    }

    // this.resultPromise = await Promise.all(this.pendingPromise);
    async wait(): Promise<void> {
        return new Promise(async (resolve: any, reject: any) => {
            Promise.all(this.pendingPromise).then(result => {
                this.resultPromise = result
                resolve(result)
            })
        })
    }

    getResult(index: number): any {
        return this.resultPromise[index];
    }
}