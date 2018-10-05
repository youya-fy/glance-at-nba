import sketch from "sketch";
import React from "react";
import { render, Text, View } from "react-sketchapp";
import moment from "moment";
import { Group } from "sketch/dom";

export default () => {
    show("⏳ 🏀");
    let container;
    let selection = sketch.getSelectedDocument().selectedLayers;
    if (!selection.isEmpty) {
        let frame
        if (selection.layers[0].type == "Artboard") {
            frame = selection.layers[0].frame;
        } else {
            frame = selection.layers[0].frame.changeBasis({
                from: selection.layers[0]
            });
        }
        processData()
            .then(games => {
                container = new Group({
                    name: "🏀",
                    parent: sketch.getSelectedDocument().selectedPage,
                    frame: frame
                });
                renderScoreBoard(games, container);
                container.adjustToFit();
                sketch.getSelectedDocument().centerOnLayer(container);
            })
            .catch(err => show("❌ can't get NBA data now"));
    } else {
        processData()
            .then(games => {
                container = new Group({
                    name: "🏀",
                    parent: sketch.getSelectedDocument().selectedPage
                });
                renderScoreBoard(games, container);
                container.adjustToFit();
                sketch.getSelectedDocument().centerOnLayer(container);
            })
            .catch(err => show("❌ can't get NBA data"));
    }
};

function renderScoreBoard(games, target) {
    if (!target) return;
    render(<ScoreBoard games={games} />, target);
}
const ScoreBoard = props => {
    if (props.games.length == 0) return <NoGame />;
    return (
        <View
            name="NBA scoreboard"
            style={{
                backgroundColor: "#666"
            }}
        >
            {props.games.map(game => (
                <Game game={game} />
            ))}
        </View>
    );
};
const NoGame = () => {
    <View name="NBA scoreboard">
        <Text>There is no game today ☹️</Text>
    </View>;
};
const Game = props => {
    let hTeam = props.game.hTeam;
    let vTeam = props.game.vTeam;
    let status = props.game.status;
    let period = props.game.period;
    let startTimeUTC = props.game.startTimeUTC;
    let startTime = moment.utc(startTimeUTC).local();
    let textFont = { fontSize: 16, color: "#fff" };
    let scoreFont = { fontSize: 20, fontWeight: 600, color: "#fff" };
    let teamStyle = isLoss => ({
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        opacity: isLoss == 0 ? 1 : 0.25,
        paddingLeft: 16,
        paddingRight: 16,
        marginTop: 4,
        marginBottom: 4
    });
    return (
        <View
            name="game"
            style={{
                backgroundColor: "#333",
                width: 368,
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 1
            }}
        >
            <View
                name="teams"
                style={{
                    flexGrow: 1,
                    flexDirection: "column",
                    justifyContent: "center",
                    height: 80
                }}
            >
                <View name="home team" style={teamStyle(hTeam.isLoss)}>
                    <Text style={textFont}>{hTeam.name}</Text>
                    {hTeam.score !== "" ? (
                        <Text style={scoreFont}>{hTeam.score}</Text>
                    ) : null}
                </View>
                <View name="visit team" style={teamStyle(vTeam.isLoss)}>
                    <Text style={textFont}>{vTeam.name}</Text>
                    {hTeam.score !== "" ? (
                        <Text style={scoreFont}>{vTeam.score}</Text>
                    ) : null}
                </View>
            </View>
            <View
                name="status"
                style={{
                    flexGrow: 0,
                    flexBasis: 80,
                    height: 80,
                    backgroundColor: status == "pending" ? "#333" : "#555",
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                <Text style={textFont}>
                    {(() => {
                        if (status == "pending") {
                            return startTime.format("hh:mm");
                        } else if (status == "finished") {
                            return "Finished";
                        } else {
                            return period.current + "\n" + period.leftTime;
                        }
                    })()}
                </Text>
            </View>
        </View>
    );
};

var DATE_FOR_FETCH = "";
function getDateForFetch() {
    // 获取日期
    return new Promise((resolve, reject) => {
        fetch("https://data.nba.net/10s/prod/v1/today.json")
            // 由于系统限制，只支持安全链接的api
            .then(res => res.json())
            .then(data => {
                let date = data.links.currentDate;
                DATE_FOR_FETCH = date;
                resolve(date);
            })
            .catch(err => reject(err));
    });
}
function getTeamFullName() {
    // 获取完整队名用于显示
    return new Promise((resolve, reject) => {
        fetch(
            `https://data.nba.net/data/10s/prod/v1/${DATE_FOR_FETCH.slice(
                0,
                4
            )}/teams.json`
        )
            .then(res => res.json())
            .then(teams => {
                let teamMapping = [];
                teams.league.standard.forEach(obj => {
                    teamMapping[obj.tricode] = obj;
                });
                resolve(teamMapping);
            })
            .catch(err => reject(err));
    });
}
function getGames(teamMapping) {
    // 获取比赛数据
    return new Promise((resolve, reject) => {
        fetch(
            `https://data.nba.net/10s/prod/v1/${DATE_FOR_FETCH}/scoreboard.json`
        )
            .then(res => res.json())
            .then(data => {
                let games = [];
                games = data.games.map(game => ({
                    vTeam: {
                        name: teamMapping[game.vTeam.triCode].fullName,
                        score: game.vTeam.score,
                        isLoss: game.vTeam.loss
                    },
                    hTeam: {
                        name: teamMapping[game.hTeam.triCode].fullName,
                        score: game.hTeam.score,
                        isLoss: game.hTeam.loss
                    },
                    status: (() => {
                        if (game.statusNum == 1) {
                            return "pending";
                        } else if (game.statusNum == 2) {
                            return "playing";
                        } else if (game.statusNum == 3) {
                            return "finished";
                        }
                    })(),
                    period: {
                        current:
                            game.period.current < 5
                                ? "Q" + game.period.current
                                : "OT" + (game.period.current - 4),
                        leftTime: game.clock
                    },
                    startTimeUTC: game.startTimeUTC
                }));
                resolve(games);
            })
            .catch(err => reject(err));
    });
}

function processData() {
    return new Promise((resolve, reject) => {
        getDateForFetch()
            .then(() => {
                return getTeamFullName();
            })
            .then(teamMapping => {
                return getGames(teamMapping);
            })
            .then(games => {
                resolve(games);
            })
            .catch(err => reject(err));
    });
}

function show(str) {
    if (!str) return;
    sketch.UI.message(str);
}
