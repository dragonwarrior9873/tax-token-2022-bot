import mongoose from "mongoose";

export const User = mongoose.model(
    "User",
    new mongoose.Schema({
        chatid: String,
        username: String,
        admin: Number,
        vip: Number,
        type: String,
        solCredit: Number,
        tokenCredit: Number,
        buyConfigLeft: Number,
        buyConfigRight: Number,
        sellConfigLeft: Number,
        sellConfigRight: Number,
        wallet: String,
        pkey: String,
        referredBy: String,
        referredTimestamp: Number,
        referralCode: String,
        timestamp: Number,
    })
);

export const Reward = mongoose.model(
    "Reward",
    new mongoose.Schema({
        chatid: String,
        solAmount: Number,
        tokenAmount: Number,
    })
);

export const Game = mongoose.model(
    "Game",
    new mongoose.Schema({
        id: Number,
        chatid: String,
        title: String,
        description: String,
        initialCost: Number,
        openTime: Number,
        closeTime: Number,
        settleTime: Number,
        approved: Number,
        conclude: Number,
        timestamp: Number,
        madeBy: String, // admin, user
        solUpPot: Number,
        solDownPot: Number,
        tokenUpPot: Number,
        tokenDownPot: Number,
        winner: Number,
    })
);

export const BetHistory = mongoose.model(
    "BetHistory",
    new mongoose.Schema({
        gameId: Number, // game id
        chatid: Number,
        solUp: Number,
        solDown: Number,
        tokenUp: Number,
        tokenDown: Number,
        timestamp: Number,
    })
);

export const Admin = mongoose.model(
    "Admin",
    new mongoose.Schema({
        name: {
            type: String,
            required: true,
        },
        password: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
        },
        permission: {
            type: String,
            required: true,
        },
        date: {
            type: Date,
            default: Date.now,
        },
    })
);

const TrxHistory = mongoose.model('Trx_History', new mongoose.Schema({
    chatid: String,
    solAmount: Number,
    tokenAmount: Number,
    mode: String,
    trxId: String,
    timestamp: Number,
}));

  
export const init = () => {
    return new Promise(async (resolve: any, reject: any) => {
        mongoose
            .connect(`mongodb://localhost:27017/${process.env.DB_NAME}`)
            .then(() => {
                console.log(`Connected to MongoDB "${process.env.DB_NAME}"...`);

                resolve();
            })
            .catch((err) => {
                console.error("Could not connect to MongoDB...", err);
                reject();
            });
    });
};

export const updateUser = (params: any) => {
    return new Promise(async (resolve, reject) => {
        User.findOne({ chatid: params.chatid }).then(async (user: any) => {
            if (!user) {
                user = new User();
            }

            user.chatid = params.chatid;
            user.username = params.username;
            user.permit = params.permit;
            user.type = params.type;
            user.admin = params.admin;
            user.vip = params.vip;

            user.solCredit = params.solCredit;
            user.tokenCredit = params.tokenCredit;
            user.buyConfigLeft = params.buyConfigLeft;
            user.buyConfigRight = params.buyConfigRight;
            user.sellConfigLeft = params.sellConfigLeft;
            user.sellConfigRight = params.sellConfigRight;
            user.wallet = params.wallet;
            user.referredBy = params.referredBy;
            user.referralCode = params.referralCode;
            user.referredTimestamp = params.referredTimestamp;

            await user.save();

            resolve(user);
        });
    });
};

export const removeUser = (params: any) => {
    return new Promise((resolve, reject) => {
        User.deleteOne({ chatid: params.chatid }).then(() => {
            resolve(true);
        });
    });
};

export async function selectUsers(params: any = {}) {
    return new Promise(async (resolve, reject) => {
        User.find(params).then(async (users) => {
            resolve(users);
        });
    });
}

export async function countUsers(params: any = {}) {
    return new Promise(async (resolve, reject) => {
        User.countDocuments(params).then(async (users) => {
            resolve(users);
        });
    });
}

export async function selectUser(params: any) {
    return new Promise(async (resolve, reject) => {
        User.findOne(params).then(async (user) => {
            resolve(user);
        });
    });
}

export async function updateUserCredit(params: any, query: any) {
    return new Promise(async (resolve, reject) => {
        User.updateOne(params, query).then(async (user) => {
            resolve(user);
        });
    });
}

export async function getRewardAmount(chatid: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
        Reward.findOne({ chatid }).then(async (user) => {
            let solAmount: number = 0;
            let tokenAmount: number = 0;
            if (user) {
                solAmount = user.solAmount ?? 0;
                tokenAmount = user.tokenAmount ?? 0;
            }

            resolve({ solAmount, tokenAmount });
        });
    });
}

export const updateReward = (
    chatid: string,
    solAmount: number,
    tokenAmount: number
) => {
    return new Promise(async (resolve, reject) => {
        Reward.findOne({ chatid }).then(async (user: any) => {
            if (!user) {
                user = new Reward();
                user.chatid = chatid;
                user.solAmount = 0;
                user.tokenAmount = 0;
            }

            user.solAmount += Number(solAmount);
            user.tokenAmount += Number(tokenAmount);

            await user.save();

            resolve(user);
        });
    });
};

export const addGame = (params: any) => {
    return new Promise(async (resolve, reject) => {
        const item = new Game();
        item.timestamp = new Date().getTime();

        const maxIds = await Game.aggregate([
            { $group: { _id: null, id: { $max: "$id" } } },
        ]);
        let maxId = 0;
        if (maxIds.length !== 0) {
            maxId = maxIds[0].id;
        }

        item.id = maxId + 1;
        item.chatid = params.chatid;
        item.title = params.title;
        item.description = params.description;
        item.initialCost = params.initialCost;
        item.openTime = params.openTime;
        item.closeTime = params.closeTime;
        item.settleTime = params.settleTime;
        item.approved = params.approved;
        item.conclude = params.conclude;

        item.solUpPot = params.solUpPot;
        item.solDownPot = params.solDownPot;
        item.tokenUpPot = params.tokenUpPot;
        item.tokenDownPot = params.tokenDownPot;

        item.madeBy = params.madeBy;
        item.winner = params.winner;

        await item.save();

        resolve(item);
    });
};

export const removeGame = (params: any) => {
    return new Promise((resolve, reject) => {
        Game.deleteOne(params).then(() => {
            resolve(true);
        });
    });
};

export async function selectGames(params: any = {}, limit: number = 0) {
    return new Promise(async (resolve, reject) => {
        if (limit) {
            Game.find(params)
                .limit(limit)
                .then(async (dcas) => {
                    resolve(dcas);
                });
        } else {
            Game.find(params).then(async (dcas) => {
                resolve(dcas);
            });
        }
    });
}

export async function selectGame(params: any) {
    return new Promise(async (resolve, reject) => {
        Game.findOne(params).then(async (user) => {
            resolve(user);
        });
    });
}

export async function selectGamePage(
    pageNumber: number,
    pageSize: number,
    filter: any = {}
) {
    try {
        const totalCount = await Game.find(filter).countDocuments();
        const totalPages = Math.ceil(totalCount / pageSize);
        pageNumber = totalPages;
        const skip = (pageNumber - 1) * pageSize;

        const games = await Game.find(filter).skip(skip).limit(pageSize).exec();

        return {
            pageCount: totalPages,
            pageSize: pageSize,
            currentPage: pageNumber,
            games: games,
        };
    } catch (error) {
        console.error("Error fetching game list:", error);
        throw error;
    }
}

export async function selectBetHistory(params: any) {
    return new Promise(async (resolve, reject) => {
        BetHistory.findOne(params).then(async (history) => {
            resolve(history);
        });
    });
}

export async function updateBetHistory(params: any, query: any) {
    return new Promise(async (resolve, reject) => {
        BetHistory.updateOne(params, query).then(async (history) => {
            resolve(history);
        });
    });
}

export async function selectBetHistories(params: any) {
    return new Promise(async (resolve, reject) => {
        BetHistory.find(params).then(async (histories) => {
            resolve(histories);
        });
    });
}

export async function getTotalAmount(params: any) {
    return new Promise(async (resolve, reject) => {
        BetHistory.aggregate(params).then(async (histories) => {
            resolve(histories);
        });
    });
}

export async function addBetHistory(params: any) {
    return new Promise(async (resolve, reject) => {
        const item = new BetHistory();
        item.timestamp = new Date().getTime();

        item.gameId = params.gameId;
        item.chatid = params.chatid;
        item.solUp = params.solUp;
        item.solDown = params.solDown;
        item.tokenUp = params.tokenUp;
        item.tokenDown = params.tokenDown;

        await item.save();

        resolve(item);
    });
}


export async function addTrxHistory(params: any = {}) {

    return new Promise(async (resolve, reject) => {
  
      try {
  
        let item = new TrxHistory();
  
        item.chatid = params.chatid
        item.solAmount = params.solAmount
        item.tokenAmount = params.tokenAmount
        item.mode = params.mode
        item.trxId = params.trxId
        item.timestamp = new Date().getTime()
  
        await item.save();
  
        resolve(true);
  
      } catch (err) {
        resolve(false);
      }
    });
  }