import User from "../../classes/structs/User";


export abstract class UserModule {
    protected readonly user: User

    constructor(user: User) {
        this.user = user
    }
}