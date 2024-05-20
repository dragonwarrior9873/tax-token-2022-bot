import express, { Router, Request, Response } from "express";
import * as GameLogic from "../game_logic";
import dotenv from "dotenv";
import { Game } from "../db";

dotenv.config();

const gameRouter = (): Router => {
    const router = express.Router();

    router.post("/game-data", async (req: Request, res: Response) => {
        let result: any;
        if (req.body.approved && !req.body.conclude)
            result = await GameLogic.getLiveGames();
        else if (!req.body.approved && !req.body.conclude)
            result = await GameLogic.getApprovalGames(
                req.body.pageNum,
                req.body.pageSize
            );
        return res.status(200).send(result);
    });

    router.post("/game-add", async (req: Request, res: Response) => {
        const result = await GameLogic.addGame(
            0,
            req.body.title,
            req.body.description,
            req.body.openTime,
            req.body.closeTime,
            req.body.settleTime,
            "ADMIN"
        );
        return res.status(200).send(result);
    });

    router.post("/game-approve", async (req: Request, res: Response) => {
        const result = await GameLogic.approveGame(req.body.id);
        return res.status(200).json(result);
    });

    router.post("/game-reject", async (req: Request, res: Response) => {
        if (await GameLogic.rejectGame(req.body.id))
            return res
                .status(200)
                .json({ message: GameLogic.ErrorMsg.SUCCESS, id: req.body.id });

        return res.status(400).json({ message: GameLogic.ErrorMsg.PARAMETER });
    });

    router.post("/game-conclude", async (req: Request, res: Response) => {
        if (await GameLogic.concludeGame(req.body.id, req.body.winner))
            return res
                .status(200)
                .json({ message: GameLogic.ErrorMsg.SUCCESS, id: req.body.id });

        return res.status(400).json({ message: GameLogic.ErrorMsg.PARAMETER });
    });

    // router.post("/game-update", (req: Request, res: Response) => {
    //     const _id: string = req.body._id;
    //     Game.findOne({ _id }).then((game) => {
    //         console.log(game);
    //         if (game) {
    //             game.updateOne(req.body).then(() => {
    //                 return res.status(200).json(req.body);
    //             });
    //         } else {
    //             return res
    //                 .status(400)
    //                 .json({ message: "No game info found to update." });
    //         }
    //     });
    // });

    router.post("/game-delete", async (req: Request, res: Response) => {
        const result = await GameLogic.removeGame(req.body.id)
            return res
                .status(200)
               .json(result);
    });

    return router;
};

export default gameRouter;
