import * as database from "./db";
import { sessions } from "./bot";
import assert from "assert";

const MAX_GAME_SIZE = 25;
const DDB_NFT_REFUND = 10;
const SOL_HOUSE_TAX = 10;
const ONLYFINS_HOUSE_TAX = 7;
const DDB_NFT_HOUSE_TAX = 4;

export enum ErrorMsg {
    SUCCESS = "success",
    INTERNAL = "internal error",
    PARAMETER = "parameter error",
    USER_INSUFFICIENT_SOL = "user insufficient sol error",
	USER_UNAVAILABLE = "unavailable user error",
}

export enum BetTo {
    UP_SOL = "UP_SOL",
    DOWN_SOL = "DOWN_SOL",
    UP_TOKEN = "UP_TOKEN",
    DOWN_TOKEN = "DOWN_TOKEN",
}

interface History {
    gameId: number;
    chatid: number;
    solUp: number;
    solDown: number;
    tokenUp: number;
    tokenDown: number;
    timestamp: number;
}

export const addGame = async (
    chatid: number, // this value is not filled in case of web request, so this could be 0
    title: string,
    description: string,
    openTime: number,
    closeTime: number,
    settleTime: number,
    madeBy?: string,
    initialCost?: number
) => {
    assert(chatid);
    assert(title);
    assert(openTime);
    assert(closeTime);
    assert(settleTime);

    if (madeBy !== "ADMIN" && initialCost ? initialCost <= 0 : false)
        return { msg: ErrorMsg.PARAMETER };

    const newGame: any = await database.addGame({
        chatid,
        title,
        description,
        openTime,
        closeTime,
        settleTime,
        approved: madeBy === "ADMIN" ? 1 : 0,
        madeBy,
        initialCost,
    });

    return { msg: ErrorMsg.SUCCESS, gameId: newGame.id };
};

export const approveGame = async (gameId: number) => {

    assert(gameId > 0);
    const game: any = await database.selectGame({ id: gameId });

    const currentTime = new Date().getTime();
    if (!game || game.openTime < currentTime) return false;

    game.approved = 1;

    try {
        const session = sessions.get(game.chatid);
		if (!session) {
			return { msg: ErrorMsg.USER_UNAVAILABLE };
		}
        if (session.solCredit < game.initialCost) {
            return { msg: ErrorMsg.USER_INSUFFICIENT_SOL };
        }

        session.solCredit -= game.initialCost;

        await database.updateUser(session);
    } catch (error) {
        return { msg: ErrorMsg.INTERNAL };
    }
    return { msg: ErrorMsg.SUCCESS };
};

export const rejectGame = async (gameId: number) => {
    assert(gameId > 0);
    const game: any = await database.selectGame({ id: gameId });

    const currentTime = new Date().getTime();
    if (!game || game.openTime < currentTime)
        return { msg: ErrorMsg.PARAMETER };

    game.approved = 0;

    try {
        await game.save();
    } catch (error) {
        return { msg: ErrorMsg.INTERNAL };
    }

    return { msg: ErrorMsg.SUCCESS };
};

export const removeGame = async (gameId: number) => {
    assert(gameId > 0);
    await database.removeGame({ id: gameId });

    return { msg: ErrorMsg.SUCCESS };
};

export const bet = async (
    gameId: number,
    chatid: number,
    amount: number,
    betTo: BetTo
) => {
    assert(gameId > 0);
    const game: any = await database.selectGame({ id: gameId });

    const currentTime = new Date().getTime();
    if (!game || !game.approved || game.conclude || game.openTime > currentTime)
        return false;

    try {
        // process game post fee
        const session = sessions.get(chatid);
		if (!session) {
			return { msg: ErrorMsg.USER_UNAVAILABLE };
		}

        if (session.solCredit < amount) {
            return { msg: ErrorMsg.USER_INSUFFICIENT_SOL };
        }

        session.solCredit -= amount;

        await database.updateUser(session);

        // TODO need house credit wallet sol amount increase
        const betHistory: any = await database.selectBetHistory({
            gameId: gameId,
            chatid: chatid,
        });
        switch (betTo) {
            case BetTo.UP_SOL:
                if (!betHistory) {
                    await database.addBetHistory({
                        gameId: gameId,
                        chatid: chatid,
                        solUp: amount,
                        solDown: 0,
                        tokenUp: 0,
                        tokenDown: 0,
                    });
                } else {
                    await database.updateBetHistory(
                        {
                            gameId: gameId,
                            chatid: chatid,
                        },
                        { $inc: { solUp: amount } }
                    );
                }
                break;
            case BetTo.DOWN_SOL:
                if (!betHistory) {
                    await database.addBetHistory({
                        gameId: gameId,
                        chatid: chatid,
                        solUp: 0,
                        solDown: amount,
                        tokenUp: 0,
                        tokenDown: 0,
                    });
                } else {
                    await database.updateBetHistory(
                        {
                            gameId: gameId,
                            chatid: chatid,
                        },
                        { $inc: { solDown: amount } }
                    );
                }
                break;
            case BetTo.UP_TOKEN:
                if (!betHistory) {
                    await database.addBetHistory({
                        gameId: gameId,
                        chatid: chatid,
                        solUp: 0,
                        solDown: 0,
                        tokenUp: amount,
                        tokenDown: 0,
                    });
                } else {
                    await database.updateBetHistory(
                        {
                            gameId: gameId,
                            chatid: chatid,
                        },
                        { $inc: { tokenUp: amount } }
                    );
                }
                break;
            case BetTo.DOWN_TOKEN:
                if (!betHistory) {
                    await database.addBetHistory({
                        gameId: gameId,
                        chatid: chatid,
                        solUp: 0,
                        solDown: 0,
                        tokenUp: 0,
                        tokenDown: amount,
                    });
                } else {
                    await database.updateBetHistory(
                        {
                            gameId: gameId,
                            chatid: chatid,
                        },
                        { $inc: { tokenDown: amount } }
                    );
                }
                break;
            default:
                if (!betHistory) {
                    await database.addBetHistory({
                        gameId: gameId,
                        chatid: chatid,
                        solUp: amount,
                        solDown: 0,
                        tokenUp: 0,
                        tokenDown: 0,
                    });
                } else {
                    await database.updateBetHistory(
                        {
                            gameId: gameId,
                            chatid: chatid,
                        },
                        { $inc: { solUp: amount } }
                    );
                }
                break;
        }
        return { msg: ErrorMsg.SUCCESS };
    } catch (error) {
        return { msg: ErrorMsg.INTERNAL };
    }
};

const hasDDBNFT = (chatid: number) => {

	const session = sessions.get(chatid);
	if (!session) {
		return false
	}
	
	// session.wallet
    return false;
};

export const concludeGame = async (gameId: number, winner: number) => {
    const game: any = await database.selectGame({ id: gameId });

    const currentTime = new Date().getTime();
    if (!game || game.closeTime < currentTime)
        return { msg: ErrorMsg.PARAMETER };

    game.conclude = 1;

    try {
        // process game concluding
        const betHistories: any = await database.selectBetHistories({
            gameId: gameId,
        });
        let upSolData: any = await database.getTotalAmount([
            {
                $project: {
                    total: {
                        $sum: "$solUp",
                    },
                    count: {
                        $cond: {
                            if: {
                                $gt: ["$solUp", 0],
                            },
                            then: 1,
                            else: 0,
                        },
                    },
                },
            },
            {
                $group: {
                    _id: "upSolData",
                    total: {
                        $sum: "$total",
                    },
                    count: {
                        $sum: "$count",
                    },
                },
            },
        ]);

        let downSolData: any = await database.getTotalAmount([
            {
                $project: {
                    total: {
                        $sum: "$solDown",
                    },
                    count: {
                        $cond: {
                            if: {
                                $gt: ["$solDown", 0],
                            },
                            then: 1,
                            else: 0,
                        },
                    },
                },
            },
            {
                $group: {
                    _id: "downSolData",
                    total: {
                        $sum: "$total",
                    },
                    count: {
                        $sum: "$count",
                    },
                },
            },
        ]);
        let upTokenData: any = await database.getTotalAmount([
            {
                $project: {
                    total: {
                        $sum: "$tokenUp",
                    },
                    count: {
                        $cond: {
                            if: {
                                $gt: ["$tokenUp", 0],
                            },
                            then: 1,
                            else: 0,
                        },
                    },
                },
            },
            {
                $group: {
                    _id: "upTokenData",
                    total: {
                        $sum: "$total",
                    },
                    count: {
                        $sum: "$count",
                    },
                },
            },
        ]);
        let downTokenData: any = await database.getTotalAmount([
            {
                $project: {
                    total: {
                        $sum: "$tokenDown",
                    },
                    count: {
                        $cond: {
                            if: {
                                $gt: ["$tokenDown", 0],
                            },
                            then: 1,
                            else: 0,
                        },
                    },
                },
            },
            {
                $group: {
                    _id: "downTokenData",
                    total: {
                        $sum: "$total",
                    },
                    count: {
                        $sum: "$count",
                    },
                },
            },
        ]);

        if (winner) {
            if (downSolData.count === 0) {
                betHistories.forEach(async (history: History) => {
                    if (history.solUp) {
                        const session = sessions.get(history.chatid);
                        session.solCredit += history.solUp;
                        await database.updateUser(session);
                    }
                });
            } else if (upSolData.users === 0) {
                betHistories.forEach(async (history: History) => {
                    if (history.solDown) {
                        if (hasDDBNFT(history.chatid)) {
                            const session = sessions.get(history.chatid);
                            session.solCredit +=
                                (history.solDown * DDB_NFT_REFUND) / 100;
                            // TODO wallet process
                            // history.solDown * (100 - DDB_NFT_REFUND) / 100;
                            await database.updateUser(session);
                        } else {
                            // TODO wallet process
                            // history.solDown
                        }
                    }
                });
            } else {
                betHistories.forEach(async (history: History) => {
                    if (history.solDown) {
                        if (hasDDBNFT(history.chatid)) {
                            const session = sessions.get(history.chatid);
                            session.solCredit +=
                                (history.solDown * DDB_NFT_REFUND) / 100;
                            downSolData.total -=
                                (history.solDown * DDB_NFT_REFUND) / 100;
                            await database.updateUser(session);
                        }
                    }
                });
                betHistories.forEach(async (history: History) => {
                    if (history.solUp) {
                        const session = sessions.get(history.chatid);
                        let userReward =
                            (history.solUp / upSolData.total) *
                            downSolData.total;
                        let getableReward = 0;
                        let houseTax = 0;
                        if (hasDDBNFT(history.chatid)) {
                            getableReward =
                                (userReward * (100 - DDB_NFT_HOUSE_TAX)) / 100;
                            houseTax = (userReward * DDB_NFT_HOUSE_TAX) / 100;
                        } else {
                            getableReward =
                                (userReward * (100 - SOL_HOUSE_TAX)) / 100;
                            houseTax = (userReward * SOL_HOUSE_TAX) / 100;
                        }
                        session.solCredit += getableReward;
                        // TODO wallet process
                        // houseTax
                        await database.updateUser(session);
                    }
                });
            }
        } else {
            if (downTokenData.count === 0) {
                betHistories.forEach(async (history: History) => {
                    if (history.tokenUp) {
                        const session = sessions.get(history.chatid);
                        session.tokenCredit += history.tokenUp;
                        await database.updateUser(session);
                    }
                });
            } else if (upTokenData.users === 0) {
                betHistories.forEach(async (history: History) => {
                    if (history.tokenDown) {
                        if (hasDDBNFT(history.chatid)) {
                            const session = sessions.get(history.chatid);
                            session.tokenCredit +=
                                (history.tokenDown * DDB_NFT_REFUND) / 100;
                            // TODO wallet process
                            // history.tokenDown * (100 - DDB_NFT_REFUND) / 100;
                            await database.updateUser(session);
                        } else {
                            // TODO wallet process
                            // history.tokenDown
                        }
                    }
                });
            } else {
                betHistories.forEach(async (history: History) => {
                    if (history.tokenDown) {
                        if (hasDDBNFT(history.chatid)) {
                            const session = sessions.get(history.chatid);
                            session.tokenCredit +=
                                (history.tokenDown * DDB_NFT_REFUND) / 100;
                            downTokenData.total -=
                                (history.tokenDown * DDB_NFT_REFUND) / 100;
                            await database.updateUser(session);
                        }
                    }
                });
                betHistories.forEach(async (history: History) => {
                    if (history.tokenUp) {
                        const session = sessions.get(history.chatid);
                        let userReward =
                            (history.tokenUp / upTokenData.total) *
                            downTokenData.total;
                        let getableReward = 0;
                        let houseTax = 0;
                        if (hasDDBNFT(history.chatid)) {
                            getableReward =
                                (userReward * (100 - DDB_NFT_HOUSE_TAX)) / 100;
                            houseTax = (userReward * DDB_NFT_HOUSE_TAX) / 100;
                        } else {
                            getableReward =
                                (userReward * (100 - ONLYFINS_HOUSE_TAX)) / 100;
                            houseTax = (userReward * ONLYFINS_HOUSE_TAX) / 100;
                        }
                        session.tokenCredit += getableReward;
                        // TODO wallet process
                        // houseTax
                        await database.updateUser(session);
                    }
                });
            }
        }
        await game.save();
    } catch (error) {
        return { msg: ErrorMsg.INTERNAL };
    }

    return { msg: ErrorMsg.SUCCESS };
};

export const getApprovalGames = async (
    pageNumber: number,
    pageSize: number
) => {
    try {
        const result = await database.selectGamePage(pageNumber, pageSize, {
            approved: 0,
            conclude: 0,
        });

        return { msg: ErrorMsg.SUCCESS, result };
    } catch (error) {
        return { msg: ErrorMsg.INTERNAL };
    }
};

export const getLiveGames = async () => {
    const currentTime = new Date().getTime();
    const result = await database.selectGames(
        {
            approved: 1,
            conclude: 0,
            openTime: { $lt: currentTime },
            closeTime: { $gt: currentTime },
        },
        MAX_GAME_SIZE
    );

    return { msg: ErrorMsg.SUCCESS, result };
};

export const getMyGames = async (chatid: string) => {
    const currentTime = new Date().getTime();
    const result = await database.selectGames(
        {
            approved: 1,
            conclude: 0,
            openTime: { $lt: currentTime },
            closeTime: { $gt: currentTime },
        },
        MAX_GAME_SIZE
    );

    return { msg: ErrorMsg.SUCCESS, result };
};

export const getGame = async (gameId: number) => {
    try {
        const result = await database.selectGame({ id: gameId });
        return { msg: ErrorMsg.SUCCESS, result };
    } catch (error) {
        return { msg: ErrorMsg.INTERNAL };
    }
};

export const getGameDetail = async (gameId: number) => {
    try {
        const result = await database.selectGame({ id: gameId });
        return { msg: ErrorMsg.SUCCESS, result };
    } catch (error) {
        return { msg: ErrorMsg.INTERNAL };
    }
};

