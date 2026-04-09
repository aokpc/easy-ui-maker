import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UImakerTreeViewProvider } from './treeViewProvider';
import { HtmlPreviewPanel } from './htmlPreviewPanel';

export function activate(context: vscode.ExtensionContext) {
    // Tree View Providerを登録
    const treeViewProvider = new UImakerTreeViewProvider();
    vscode.window.registerTreeDataProvider('uimaker-tools-view', treeViewProvider);

    const initCommand = vscode.commands.registerCommand('uimaker-ext.init', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const folderPath = workspaceFolder.uri.fsPath;

        // index.html作成
        const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ESP32/Pico W UI</title>
    <style>
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #ffffff;
    margin: 8px;
}

h1 {
    text-align: center;
    color: #333;
    margin-bottom: 30px;
    font-size: 24px;
}

.controls {
    margin-bottom: 30px;
}

button {
    min-width: 120px;
    padding: 12px 20px;
    font-size: 16px;
    font-weight: 600;
    color: white;
    background: #667eea;
    border: none;
    border-radius: 5px;
}

button:hover {
    background: #b766ea;
}

button:active {
    background: #d866ea;
}

.status {
    background: #f5f5f5;
    padding: 15px;
    border-radius: 5px;
    border-left: 4px solid #667eea;
}

.status p {
    color: #666;
    font-size: 14px;
}

.status span {
    font-weight: bold;
    color: #333;
}
    </style>
</head>
<body>
    <div id="app">
        <h1>ESP32/Pico W UI Control Panel</h1>
        <div class="controls">
            <button onclick="apiClick(1)">Button 1</button>
            <button onclick="apiClick(2)">Button 2</button>
            <button onclick="apiClick(3)">Button 3</button>
            <button onclick="apiClick(4)">Button 4</button>
        </div>
        <div class="status">
            <p>Status: <span id="status">Ready</span></p>
        </div>
    </div>
    <script>
const status = document.getElementById('status');
function apiClick(id){
    console.log('Button', id, 'clicked');
    status.textContent = 'Button' + id + 'pressed';
    arduino.click(id);
}
    </script>
</body>
</html>`;
        try {
            // ファイルの存在確認
            const htmlPath = path.join(folderPath, 'index.html');
            const funcPath = path.join(folderPath, 'functions.txt');

            const filesExist = fs.existsSync(htmlPath) || fs.existsSync(funcPath);

            if (filesExist) {
                const answer = await vscode.window.showWarningMessage(
                    'HTMLファイルが既に存在します。上書きしますか？',
                    '上書き',
                    'キャンセル'
                );

                if (answer !== '上書き') {
                    return;
                }
            }

            fs.writeFileSync(htmlPath, htmlContent);
            fs.writeFileSync(funcPath, "click");
            vscode.window.showInformationMessage('HTML UIが初期化されました');
        } catch (error) {
            vscode.window.showErrorMessage(`ファイル作成エラー: ${error}`);
        }
    });

    // コマンド2: HTMLを結合してC/Codeコード生成
    const generateCommand = vscode.commands.registerCommand('uimaker-ext.generate', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const folderPath = workspaceFolder.uri.fsPath;

        try {
            // ファイル読み込み
            const htmlFile = path.join(folderPath, 'index.html');
            const funcFile = path.join(folderPath, 'functions.txt');

            if (!fs.existsSync(htmlFile)) {
                vscode.window.showErrorMessage('index.htmlが見つかりません。先に初期化してください。');
                return;
            }

            // 関数リストを読み込み
            let functionList: string[] = [];
            if (fs.existsSync(funcFile)) {
                const funcContent = fs.readFileSync(funcFile, 'utf8');
                functionList = funcContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
            }

            let htmlContent = fs.readFileSync(htmlFile, 'utf8');
            htmlContent += "<script>" + generateArduinoProxy(functionList) + "</script>"

            // C/Codeコード生成
            const cCode = generateCCode(htmlContent, functionList);
            const cExpl = generateCExample(functionList);
            // ファイル保存
            const outputFile = path.join(folderPath, 'ui_server.h');
            const exampleFile = path.join(folderPath, 'ui_example.h');
            fs.writeFileSync(outputFile, cCode.replace(/    /g, ""));
            fs.writeFileSync(exampleFile, cExpl);

            vscode.window.showInformationMessage(`C/Codeコードが生成されました: ${outputFile}`);
        } catch (error) {
            vscode.window.showErrorMessage(`生成エラー: ${error}`);
        }
    });

    // コマンド3: HTML Viewでindex.htmlを開く
    const openHtmlViewCommand = vscode.commands.registerCommand('uimaker-ext.openHtmlView', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const folderPath = workspaceFolder.uri.fsPath;
        const htmlFile = path.join(folderPath, 'index.html');
        const funcFile = path.join(folderPath, 'functions.txt');

        if (!fs.existsSync(htmlFile)) {
            vscode.window.showErrorMessage('index.htmlが見つかりません。先に初期化してください。');
            return;
        }

        try {
            // 関数リストを読み込み
            let functionList: string[] = [];
            if (fs.existsSync(funcFile)) {
                const funcContent = fs.readFileSync(funcFile, 'utf8');
                functionList = funcContent
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
            }

            // HTMLを読み込み
            let htmlContent = fs.readFileSync(htmlFile, 'utf8');
            functionList.includes
            // ArduinoProxyとconsole postMessageスクリプトを挿入
            const injectedScript = `
<script>
const vscode = acquireVsCodeApi();

// Arduino Function Proxy
const arduino = new Proxy({}, {
    get(target, prop) {
        const functionList = ${JSON.stringify(functionList)};
        const funcName = String(prop);
        if (!(functionList.includes(funcName))) {
            return undefined;
        }
        return async function(...args) {
            sendToVSCode('arduino', ["Arduino /api called:", funcName, ...args]);
        };
    }
});

// Intercept console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

function sendToVSCode(type, args) {
    vscode.postMessage({
        type: 'console',
        level: type,
        message: args.map(a => {
            if (typeof a === 'object') {
                try { return JSON.stringify(a); }
                catch(e) { return String(a); }
            }
            return String(a);
        }).join(' ')
    });
}

console.log = function(...args) {
    originalLog.apply(console, args);
    sendToVSCode('log', args);
};

console.error = function(...args) {
    originalError.apply(console, args);
    sendToVSCode('error', args);
};

console.warn = function(...args) {
    originalWarn.apply(console, args);
    sendToVSCode('warn', args);
};

console.info = function(...args) {
    originalInfo.apply(console, args);
    sendToVSCode('info', args);
};
</script>
`;

            // </body>の前に挿入
            htmlContent = htmlContent + injectedScript;

            // 一時ファイルに保存
            const tmpFile = path.join(folderPath, '.index.tmp.html');
            fs.writeFileSync(tmpFile, htmlContent);

            // HTMLPreviewPanelで表示
            HtmlPreviewPanel.createOrShow(context.extensionPath, tmpFile);
        } catch (error) {
            vscode.window.showErrorMessage(`HTMLビューエラー: ${error}`);
        }
    });

    context.subscriptions.push(initCommand, generateCommand, openHtmlViewCommand);
}

function generateCExample(functionList: string[]) {
    return `// Arduino sketch 例

const char* SSID = "YOUR_SSID";
const char* PASSWORD = "YOUR_PASSWORD";

#include "./ui_server.h"

// 呼び出すための関数を作成する
// functions.txtに関数名を記載する
${functionList.map((funcName, index) =>
        `uint16_t ${funcName}(const uint16_t* args, uint16_t argCount, uint16_t* result, uint16_t resultMax) {
    // args: 入力の引数のリスト
    // argCount: argsのリストの数
    // result: 返す値を入れる
    // return: 実際に返した値の個数
    
    return 0;  // 実際に返した値の個数
}`
    ).join('\n\n')}

// example
uint16_t example_click(const uint16_t* args, uint16_t argCount, uint16_t* result, uint16_t resultMax) {
    Serial.print("click: ");
    Serial.println(args[0]); // 引数の0番目
    return 0;  // 返却値0個
}

void setup() {
    Serial.begin(115200);
    delay(100);
    // WiFi.mode(WIFI_AP); // APモード(ルーター)
    setupWiFi();
    setupWebServer();
}

void loop() {
    handleWebClient();
    delay(1);
}
`
}

function generateCCode(htmlContent: string, functionList: string[]): string {
    // 関数ポインタ配列の生成
    const funcDeclarations = functionList.map((funcName, index) =>
        `uint16_t ${funcName}(const uint16_t* args, uint16_t argCount, uint16_t* result, uint16_t resultMax);`
    ).join('\n');

    const funcArray = functionList.map((funcName, index) =>
        `    ${funcName}`
    ).join(',\n');

    return `#ifndef UI_SERVER_H
#define UI_SERVER_H

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

// HTML UI Content
const char HTML_CONTENT[] = R"=====(
${htmlContent}
)=====" ;

// WiFi settings - Configure these for your network
// const char* SSID = "YOUR_SSID";
// const char* PASSWORD = "YOUR_PASSWORD";

// Web server on port 80
WebServer server(80);

// ========================
// Function Declarations
// ========================
${funcDeclarations}

// Function pointer array
typedef uint16_t (*FuncPtr)(const uint16_t* args, uint16_t argCount, uint16_t* result, uint16_t resultMax);
const FuncPtr functionTable[] = {
${funcArray}
};
const uint16_t functionCount = ${functionList.length};

// ========================
// API Handler
// ========================
void handleApiRequest() {
    if (server.method() != HTTP_POST) {
        server.send(400, "text/plain", "POST only");
        return;
    }

    if (server.contentLength() < 2) {
        server.send(400, "text/plain", "No data");
        return;
    }

    // Read binary data
    size_t bodyLen = server.contentLength() / 2;  // Each uint16_t is 2 bytes
    
    if (bodyLen < 1 || bodyLen > 32) {
        server.send(400, "text/plain", "Invalid data size");
        return;
    }

    // Parse binary to uint16_t array
    uint16_t bodyData[32] = {0};
    uint8_t buffer[64] = {0};
    
    size_t read = server.client().readBytes(buffer, server.contentLength());
    if (read != server.contentLength()) {
        server.send(400, "text/plain", "Read error");
        return;
    }

    // Convert little-endian bytes to uint16_t
    for (size_t i = 0; i < bodyLen; i++) {
        bodyData[i] = buffer[i * 2] | (buffer[i * 2 + 1] << 8);
    }

    // First uint16_t is function index
    uint16_t funcIndex = bodyData[0];
    uint16_t argCount = bodyLen - 1;

    if (funcIndex >= functionCount) {
        server.send(404, "text/plain", "Function not found");
        return;
    }

    // Extract arguments from bodyData
    uint16_t args[32] = {0};
    uint16_t result[32] = {0};
    
    for (uint16_t i = 0; i < argCount && i < 32; i++) {
        args[i] = bodyData[i + 1];
    }

    // Call function
    uint16_t resultLen = functionTable[funcIndex](args, argCount, result, 32);

    // Build response (binary)
    uint8_t response[64] = {0};
    for (uint16_t i = 0; i < resultLen && i < 32; i++) {
        response[i * 2] = result[i] & 0xFF;
        response[i * 2 + 1] = (result[i] >> 8) & 0xFF;
    }

    server.sendHeader("Content-Type", "application/octet-stream");
    server.sendHeader("Content-Length", String(resultLen * 2));
    server.sendHeader("Connection", "close");
    server.client().write(response, resultLen * 2);
}

void setupWebServer() {
    // Serve the UI
    server.on("/", HTTP_GET, []() {
        server.send(200, "text/html", HTML_CONTENT);
    });

    // API endpoint for function calls
    server.on("/api", HTTP_POST, []() {
        handleApiRequest();
    });

    // 404 handler
    server.onNotFound([]() {
        server.send(404, "text/plain", "Not Found");
    });

    server.begin();
    Serial.println("Web server started");
}

void handleWebClient() {
    server.handleClient();
}

void setupWiFi() {
    Serial.println("Connecting to WiFi: " + String(SSID));
    WiFi.begin(SSID, PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.println("WiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("Failed to connect to WiFi");
    }
}

#endif // UI_SERVER_H
`;
}


export function deactivate() {
}

function generateArduinoProxy(functionList: string[]): string {
    // Function index map
    const funcMap = functionList.reduce((acc, name, index) => {
        acc[name] = index;
        return acc;
    }, {} as Record<string, number>);

    return `
// Arduino Function Proxy
const arduino = new Proxy({}, {
    get(target, prop) {
        const funcMap = ${JSON.stringify(funcMap)};
        const funcName = String(prop);
        if (!(funcName in funcMap)) {
            return undefined;
        }
        
        const funcIndex = funcMap[funcName];
        
        return async function(...args) {
            const data = new Uint16Array([funcIndex, ...args]);
            const buffer = new ArrayBuffer(data.length * 2);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < data.length; i++) {
                view[i * 2] = data[i] & 0xFF;
                view[i * 2 + 1] = (data[i] >> 8) & 0xFF;
            }
            
            try {
                const response = await fetch('/api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/octet-stream' },
                    body: buffer
                });
                
                if (!response.ok) {
                    throw new Error('API error: ' + response.status);
                }
                
                const resBuf = await response.arrayBuffer();
                const result = new Uint16Array(resBuf);
                
                return result;
            } catch (error) {
                console.error('Arduino function call error:', error);
                throw error;
            }
        };
    }
});
`;
}
