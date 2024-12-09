"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SbSnippetGenerator = void 0;
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const openai_1 = __importDefault(require("openai"));
const openai = new openai_1.default({
    apiKey: "api-key",
});
//
const PORT = 50000;
let socket;
let link;
let stateNumber;
let candidates;
const path = require("path");
class SbSnippetGenerator {
    frontCursorTextLength;
    frontCursorText;
    backCursorText;
    constructor(frontCursorTextLength, frontCursorText, backCursorText) {
        this.frontCursorTextLength = frontCursorTextLength;
        this.frontCursorText = frontCursorText;
        this.backCursorText = backCursorText;
    }
    getCandidatesForStates(states) {
        console.log("_dirname", __dirname);
        const fileName = path.join(__dirname, "../src/smallbasic-syntax-completion-candidates-results.txt");
        let fileContent = fs.readFileSync(fileName, "utf8");
        const result = [];
        for (const state of states) {
            const start = `State ${state}`;
            const end = `State ${state + 1}`;
            const startIdx = fileContent.indexOf(start);
            const endIdx = fileContent.indexOf(end);
            const Text = fileContent.substring(startIdx, endIdx);
            console.log("Text :", Text);
            const lines = Text.split("\n");
            for (const line of lines) {
                // State deletion statement
                if (line[0] !== "[") {
                    continue;
                }
                const parts = line.split(":");
                const key = parts[0].trim();
                const value = parseInt(parts[1].trim());
                const sortText = value.toString();
                result.push({ key, value, sortText });
            }
        }
        console.log("result", result);
        return result;
    }
    onDataReceived(callback) {
        this.dataReceivedCallback = callback;
    }
    dataReceivedCallback = null;
    accessServer1(host) {
        try {
            // Connecting a socket to a server
            link = new net.Socket();
            if (!link) {
                return;
            }
            link.connect(PORT, host, () => {
                console.log("Client connected");
            });
            link.on("data", data => {
                const decodedString = data.toString("utf-8");
                console.log("data: ", data);
                console.log("decodedString: ", decodedString);
                if (decodedString === "SuccessfullyParsed") {
                    stateNumber = [0];
                }
                else {
                    const extractedNumbers = decodedString.match(/\d+/g);
                    stateNumber = extractedNumbers ? extractedNumbers.map(Number) : [];
                    console.log("StateNumber: ", stateNumber);
                }
                const a = 1;
                candidates = this.getCandidatesForStates(stateNumber);
                console.log("Data received from server:", decodedString);
                // Set sortText value for setting Ranking in candidate group
                candidates.sort((a, b) => b.value - a.value);
                candidates.forEach((item, index) => {
                    item.sortText = (index + 1).toString().padStart(3, "0"); // 순위는 1부터 시작
                });
                if (this.dataReceivedCallback) {
                    let completionItems = [];
                    for (const { key, value, sortText } of candidates) {
                        let completionWord = key;
                        completionWord = completionWord
                            .replace(/^\[/, "") // Remove starting brackets
                            .replace(/\]$/, "") // Remove end brackets
                            .replace(/,/g, "") // Delete comma
                            .replace(/\s+\bT\b/g, " ") // Replace 'T' with a space
                            .replace(/\bT\b/g, "") // Delete 'T'
                            .replace(/\bNT\b/g, "") // Delete 'NT'
                            .replace(/\s+/g, " ") // Change multiple spaces to 1 space
                            .replace(/\s+\./g, ".") // Remove spaces on both sides of '.'
                            .replace(/\.\s+/g, ".") // Remove spaces on both sides of '.'
                            .replace(/\bTO\b/g, " TO ");
                        completionItems.push({
                            key: completionWord,
                            value: value,
                            sortText: sortText,
                        });
                    }
                    this.dataReceivedCallback(completionItems);
                }
            });
            link.on("end", () => {
                console.log("Client disconnected");
            });
        }
        catch (error) {
            // Exception handling when connection is refused
            console.log("Server connection refused");
            console.error(error.message);
        }
    }
    /**
     * Function to terminate server connection
     */
    closingConnecting1() {
        try {
            if (link) {
                console.log("Disconnected");
                link.end();
                link = null;
            }
        }
        catch (error) {
            console.error(error.message);
        }
    }
    // A function that passes the value that needs to be passed to the "sbparser" server.
    getCompletionItems() {
        if (link === null) {
            return;
        }
        this.accessServer1("localhost");
        link.write(`${this.frontCursorTextLength}`);
        console.log("Length of text before cursor :", this.frontCursorTextLength);
        link.end();
        this.closingConnecting1();
        this.accessServer1("localhost");
        link.write(`${this.frontCursorText}`);
        console.log("Text before cursor :", this.frontCursorText);
        link.end();
        this.closingConnecting1();
        this.accessServer1("localhost");
        link.write(`${this.backCursorText}`);
        console.log("Back text :", this.backCursorText);
        link.end();
        this.closingConnecting1();
        this.accessServer1("localhost");
    }
    /**
     *  A function that takes a completionItem and returns a code snippet conforming to Small Basic syntax.
     * @param completionItem
     * @returns placeholders
     */
    async getInsertText(completionItem, resulted_prefix) {
        // Split string into words
        const itemString = typeof completionItem === "string"
            ? completionItem
            : completionItem.label;
        // Split strings by spaces and parentheses using regular expressions, but keep parentheses and exclude whitespace elements
        const words = itemString
            .split(/(\s+|(?<=\()|(?=\()|(?<=\))|(?=\)))/g)
            .filter(word => word.trim());
        console.log("words:", words);
        const modifiedWords = words.map(word => {
            if (word === "ID") {
                return "Identifier";
            }
            else if (word === "STR") {
                return "String";
            }
            else if (word === "Exprs" || word === "Expr") {
                return "Expression";
            }
            else {
                return word;
            }
        });
        if (resulted_prefix === "codecompletion") {
            let placeholders = words
                .map((word, index) => {
                let placeholder;
                switch (word) {
                    case "CR":
                        placeholder = `\n`;
                        break;
                    case "TheRest":
                        placeholder = "";
                        break;
                    case "OrExpr":
                        placeholder = `\${${index + 1}:OR}`;
                        break;
                    case "AndExpr":
                        placeholder = `\${${index + 1}:AND}`;
                        break;
                    case "EqNeqExpr":
                        placeholder = `\${${index + 1}:==}`;
                        break;
                    case "OptStep":
                        placeholder = `\${${index + 1}:Step}`;
                        break;
                    case "CRStmtCRs":
                        placeholder = `\n\${${index + 1}:body}\n`;
                        break;
                    default:
                        // TabStop not applied when parentheses and = are included
                        if (word.trim() === "(" ||
                            word.trim() === ")" ||
                            word.trim() === "=") {
                            placeholder = word.trim();
                        }
                        else {
                            placeholder = `\${${index + 1}:${word.trim()}}`;
                        }
                }
                // Add a space if the element does not contain \n
                return placeholder.includes("\n") ? placeholder : placeholder + " ";
            })
                .join("");
            placeholders = placeholders.replace(/\s+\(/g, "(");
            console.log("placeholders", placeholders);
            return placeholders;
        }
        else {
            const modifiedStructCandi = modifiedWords.join(" ");
            console.log("modifiedWords:", modifiedWords);
            console.log("modifiedStructCandi:", modifiedStructCandi);
            const prompt = `
                This is the incomplete SmallBasic programming language code:
                ${resulted_prefix}
                '${modifiedStructCandi}'
                Complete the '${modifiedStructCandi}' part of the code in the SmallBasic programming language. Just show your answer in place of '${modifiedStructCandi}'. 
                `;
            const chat_completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo-0125",
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            });
            const response = chat_completion.choices[0].message.content;
            console.log("response:", response);
            return response;
        }
        // Create a new string by adding a TabStop to each word
    }
}
exports.SbSnippetGenerator = SbSnippetGenerator;
//# sourceMappingURL=sbSnippetGenerator.js.map