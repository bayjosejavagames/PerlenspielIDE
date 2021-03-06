//Initialize jquery and FancyTree
const jqueryUI = require('jquery-ui');
const fancyTree = require('jquery.fancytree');

//create references to subclasses so that we can interface with them.
//These are the modules that are loaded and specific to Perlenspeil IDE
let myFileManager;
let myFileBrowser;
let myGrid;
let language;
let tabManager;

//Version number of this project.
let version = '18w39';

//This is the perlenspeil instance
let Perlenspeil;

//This is the reference to the codeMirror editor.
let editor;

//This is the set of all current suggestions
//TODO encapsulate this
let suggestions = [];

//TODO encapsulate this as a 'lineResize' event
let lastSize = 0;

//TODO encapulate the console into its own class
let consoleCommands = [];
let consoleIndex = -1;

function init() {
    //Include all needed modules
    const grid              = require('./grid');
    const fileManager       = require('./fileManager');
    const fileBrowser       = require('./fileBrowser');
    const languageParser    = require('./languageParser');
    const tabs              = require('./tabManager');

    //Initialize the file manager, and load the configuration file.
    myFileManager = new fileManager();
    myFileBrowser = new fileBrowser();
    myFileManager.initialize().then(function(result) {
        //Print out version information and Author information.
        console.log("Perlenspeil IDE Version:", version);
        console.log("Created by Bailey Sostek with the help of Professor Brian Moriarty in 2018");

        //Initialize the Grid API with the screen width and height. This will create a reasponsive grid that can hold the rest of the editor elements.
        myGrid = new grid(screen.width, screen.height);

        //Create the Editor and set up preliminary configuration data.
        let editorDiv = document.createElement('div');
        editorDiv.setAttribute('id', 'editor');
        editor = CodeMirror(editorDiv, {
            mode: "javascript",
            theme: "darcula",
            autofocus:true,
            lineNumbers: true,
            autoCloseBrackets: true,
            autoMatchBrackets: true,
            gutters: ["CodeMirror-linenumbers", "breakpoints"],
        });

        //Initialize the language from the language configuration file.
        language = new languageParser(result);

        //Initialize the tab manager
        tabManager = new tabs();

        // let titleBar = document.createElement('div');
        // titleBar.setAttribute('id', 'titleBar');
        // titleBar.innerText='HEy This is a test of the title bar.';
        // document.body.appendChild(titleBar);

        let testDiv4 = document.createElement('div');
        testDiv4.style.overflow = 'auto';
        testDiv4.innerText = '';
        testDiv4.style.color = '#a9b7c6';



        // editor.setSize('auto', 'auto');

        let testDiv3 = document.createElement('div');
        testDiv3.setAttribute('id', 'tree');

        let column1 = myGrid.addColumn(myGrid.createColumn([testDiv3, testDiv4] , {'color':'#232323'}));
        myFileManager.getProjectFiles('').then(function(result) {
            setTimeout(function (){
                console.log("result:",result);

                $("#tree").fancytree({
                    checkbox: false,
                    selectMode: 3,
                    source: {children:result},
                    activate: function(event, data) {
                        $("#statusLine").text(event.type + ": " + data.node);
                    },
                    select: function(event, data) {
                        $("#statusLine").text(
                            event.type + ": " + data.node.isSelected() + " " + data.node
                        );

                    },
                    dblclick:function(event, data) {
                        tabManager.openFile(data);
                    },
                });
            }, 1000);
        }, function(err) {
            console.log(err);
        });

        let outputConsole = document.createElement('div');
        outputConsole.setAttribute('id', 'outputConsole');
        outputConsole.style.color = '#a9b7c6';

        let inputConsole = document.createElement('input');
        inputConsole.setAttribute('type', 'text');
        inputConsole.style.width = '100%';
        inputConsole.style.height = '100%';
        inputConsole.style.position = 'absolute';

        let editorContainer = document.createElement('div');
        editorContainer.appendChild(editorDiv);

        let column2 = myGrid.addColumn(myGrid.createColumn([tabManager.getElement(), editorContainer, outputConsole,inputConsole], {'color':'#232323'}));
        // column2.registerCallback(editorDiv, function (data) {
        //     // console.log("Callback for this editorDiv being resized:",data);
        //     editor.setSize('auto', (((parseFloat(data.style.height)-3)/100)*screen.height));
        // });
        editor.setSize('auto', 'auto');

        tabManager.getElement().parentNode.style.overflow = 'visible';

        tabManager.registerFiletype('png', (name) => {
            console.log("path","Projects/"+myFileManager.loadedProject+'/'+name);
            while(editorContainer.firstChild){
                editorContainer.removeChild(editorContainer.firstChild);
            }
            let imgWrapper = document.createElement('div');
            imgWrapper.innerHTML = "<img src=Projects/"+myFileManager.loadedProject+'/'+name+"></img>";
            editorContainer.appendChild(imgWrapper);
        });
        tabManager.registerFiletype('js', (name) => {
            while(editorContainer.firstChild){
                editorContainer.removeChild(editorContainer.firstChild);
            }
            editorContainer.appendChild(editorDiv);
            //Set the Editor data to be the game.js of the current project.
            myFileManager.loadFile(name).then(function(result) {
                getEditor().setValue(result);
                language.loadFileSpecificData(result);
                lastSize = getEditor().doc.size;
                getEditor().on('change', function () {
                    let newSize = getEditor().doc.size;
                    let value = language.removeFrontSpacing(getEditor().getLine(getEditor().getCursor().line));

                    console.log("lastSize:",lastSize,"new Size:",newSize);
                    if(!(newSize == lastSize)){
                        let delta = newSize - lastSize;
                        if(delta > 0){
                            console.log("Added ", delta, " lines.");
                        }
                        if(delta < 0){
                            console.log("Removed ", Math.abs(delta), " lines.");
                        }
                        language.offsetScopes(delta, getEditor().getCursor());
                    }

                    let l_function = language.getSuggestion(language.getLastToken(language.tokeniseString(value)), getEditor().getCursor());
                    if(l_function){
                        console.log(l_function);

                        let tableText = '<table>';
                        for(let i = 0; i < l_function.length; i++){
                            tableText += '<tr>';
                            tableText += '<td>';
                            tableText += l_function[i].getNAME();
                            tableText += '</td>';
                            tableText += '</tr>';
                        }
                        tableText += '</table>';
                        testDiv4.innerHTML = tableText;
                    }
                    suggestions = l_function;
                });
            }, function(err) {
                console.log(err);
            });
        });

        getEditor().on("gutterClick", function(cm, n) {
            var info = cm.lineInfo(n);
            cm.setGutterMarker(n, "breakpoints", info.gutterMarkers ? null : makeMarker());
            console.log("Clicked on :",info);
            //Then determine if there are variables on that line
            console.log("vars in scope:",language.cursorToScope({line:info.line, ch:0}).getVars());
        });

        language.registerInterestInTokens(['PS.COLOR'], function(data){
            editor.setGutterMarker(data.n, "breakpoints", colorPicker(data));
        });

        let column3 = myGrid.addColumn(myGrid.createColumn("test", {'color':'#232323'}));
        // myGrid.addColumn(myGrid.createColumn("Test" , '#004106'));
        // myGrid.addColumn(myGrid.createColumn("test", '#002341'));


        let psTest = document.createElement("webview");
        // psTest.setAttribute("src", "http://users.wpi.edu/~bhsostek/Assignment13/game.html");
        psTest.setAttribute("src", 'Projects/'+myFileManager.loadedProject+'/game.html');
        psTest.style.height = 100+'%';
        psTest.addEventListener('console-message', (e) => {
            if(!e.message.includes('\n')){
                outputConsole.innerText += e.message + '\n';
            }else{
                outputConsole.innerText += e.message;
            }
            outputConsole.parentNode.scrollTop = outputConsole.parentNode.scrollHeight;
        });

        //Wait for the
        inputConsole.parentNode.style.overflow = 'visible';
        inputConsole.addEventListener("keydown", function(event) {
            loop:{
                if (event.keyCode === 13) { //Enter
                    event.preventDefault();
                    if(inputConsole.value.length > 0) {
                        psTest.executeJavaScript(inputConsole.value);
                        psTest.executeJavaScript("PS.gridRefresh();");
                        if (consoleIndex == -1) {
                            if (consoleCommands.length > 0) {
                                consoleCommands.splice(0, 0, inputConsole.value);
                            } else {
                                consoleCommands.push(inputConsole.value);
                            }
                            // console.log(consoleCommands);
                        }
                        inputConsole.value = '';
                        consoleIndex = -1;
                        break loop;
                    }
                }
                if (event.keyCode === 38) { //UP arrow
                    event.preventDefault();
                    if (consoleIndex < consoleCommands.length - 1) {
                        consoleIndex++;
                    } else {
                        //Noise maybe
                    }
                    if(consoleCommands[consoleIndex]) {
                        inputConsole.value = consoleCommands[consoleIndex];
                    }
                    // console.log('index',consoleIndex);
                    break loop;
                }
                if (event.keyCode === 40) { //Down arrow
                    event.preventDefault();
                    if (consoleIndex >= 0) {
                        consoleIndex--;
                    } else {
                        //Noise maybe
                    }
                    if (consoleIndex >= 0) {
                        inputConsole.value = consoleCommands[consoleIndex];
                    } else {
                        inputConsole.value = '';
                    }
                    // console.log('index',consoleIndex);
                    break loop;
                }
                //IF the editor text is changed then flag this new command to be pushed onto the command stack
                consoleIndex = -1;
            }
        });

        Perlenspeil = psTest;

        let apiDocumentation = document.createElement("webview");
        // psTest.setAttribute("src", "http://users.wpi.edu/~bhsostek/Assignment13/game.html");
        apiDocumentation.setAttribute("src", 'http://users.wpi.edu/~bmoriarty/ps/api.html');
        // apiDocumentation.setAttribute("src", 'http://cadmiumgames.com');
        apiDocumentation.style.height = 100+'%';


        column3.addChild(psTest);
        column3.addChild(apiDocumentation);

        myFileManager.getProjectData('WIDTHS').then(function(result) {
            //This is an array of arrays.
            myGrid.initializeGrid(result);
        }, function(err) {
            console.log(err);
        });

        myGrid.refresh();
        editor.refresh();

        //Disable drag abilities on the Webviews
        psTest.addEventListener('dragover', event => event.preventDefault());
        psTest.addEventListener('drop', event => event.preventDefault());
        apiDocumentation.addEventListener('dragover', event => event.preventDefault());
        apiDocumentation.addEventListener('drop', event => event.preventDefault());

    }, function(err) {
        console.log(err);
    });
}

function getEditor() {
    return editor;
}

function makeMarker() {
    let marker = document.createElement("div");
    marker.style.color = "#822";
    marker.innerHTML = "▢";
    return marker;
}

function colorPicker(data) {
    let marker = document.createElement("div");
    let color;
    for(let i = 0; i < data.lineTokens.length; i++){
        if(data.lineTokens[i].includes("PS.COLOR")){
            color = data.lineTokens[i];
        }
    }
    if(color) {
        Perlenspeil.executeJavaScript(color, function(result) {
            console.log("Result:",toHex(result));
            marker.style.color = toHex(result);
            marker.innerHTML = "■";
        });
    }
    return marker;
}



/**
 * Callback function executed when the windows close button is pressed.
 * The code below is a blocking call that must terminate before the window can be closed.
 **/
function onCloseRequested(){
    myFileManager.writeToProperties('WIDTHS', myGrid.getGridSize());
}

/**
 * Function to execute when the open project option is selected from the menu.
 * @param {Object} path
 * @path is the relative path to the currently opened project. It is a stringified json object that must be
 **/
function open(path){
    //Makes sure that a valid path was passed into this function, not undefined.
    if(path) {
        //Print the selected path
        console.log("Opening:" + path);
        //Turn Path from an object into a string that can be manipulated.
        //Replace all quote characters with nothing.
        path = JSON.stringify(path).replace(new RegExp('"', 'g'), '');
        //Break this path into its component directories by splitting the string into a string array on each '/' character.
        let brokenPath = path.split('\\');
        let cleanPath = [];
        //Take out unwanted characters.
        for (var i = 0; i < brokenPath.length; i++) {
            brokenPath[i] = brokenPath[i].replace('[', '').replace(']', '');
            if (brokenPath[i]) {
                cleanPath.push(brokenPath[i]);
            }
        }
        //Print our cleaned path.
        console.log("Clean Path:"+cleanPath);
        //Reload the editor with the new data.
        Perlenspeil.setAttribute("src", 'Projects/' + cleanPath[cleanPath.length - 1] + '/game.html');
    }else{ //When no path is selected this portion of the function triggers.
        console.log("No Directory Selected.");
    }
}

function save(){
    console.log("Save");
    myFileManager.writeToFile('game.js', getEditor().getValue()).then(function(result) {
        Perlenspeil.setAttribute("src", 'Projects/'+myFileManager.loadedProject+'/game.html');
    }, function(err) {
        console.log(err);
    });
    console.log(myGrid.getGridSize());
    language.lookForInterestingTokens();
}

function copy(){
    //This is the OSX copy function
    if(process.platform == 'darwin') {
        let proc = require('child_process').spawn('pbcopy');
        let value = $('textArea').val();
        proc.stdin.write(value);
        proc.stdin.end();
    }
}

function paste(){
    let value = '';
    if(process.platform == 'darwin') {
        let proc =  require('child_process').spawn('pbpaste');
        proc.stdout.on('data', function(data) {
            value = data.toString();
            getEditor().replaceRange(value, getEditor().getCursor(), getEditor().getCursor());
        });
    }
}

function suggest(){
    if(suggestions){
        // console.log("Suggesting@",getEditor().getCursor());
        // console.log("Line:",getEditor().getLine(getEditor().getCursor().line));
        // console.log("Token:",language.getLastToken(language.tokeniseString(language.removeFrontSpacing(getEditor().getLine(getEditor().getCursor().line)))));
        // console.log("Token Length:", language.getLastToken(language.tokeniseString(getEditor().getLine(getEditor().getCursor().line))).length);

        let lastToken = language.getLastToken(language.tokeniseString(getEditor().getLine(getEditor().getCursor().line)));
        let startPos = {
            line:getEditor().getCursor().line,
            ch:getEditor().getCursor().ch - lastToken.length
        };
        console.log("Start Pos:", startPos);
        getEditor().replaceRange(suggestions[0].getNAME(), startPos, getEditor().getCursor());
    }
}

function comment(){
    let max;
    let min;

    let commentHead = language.getCommentHead();
    let commentTail = language.getCommentTail();

    if(getEditor().getCursor('head').line > getEditor().getCursor('anchor').line){
        max = getEditor().getCursor('head');
        min = getEditor().getCursor('anchor');
    }else{
        max = getEditor().getCursor('anchor');
        min = getEditor().getCursor('head');
    }

    let value = getEditor().getRange(min,max);
    value = value.split('\n');

    //Check if this is a comment or uncomment action.
    let uncommnet = true;

    for(let i = 0; i < value.length; i++){
        if(!value[i].includes(commentHead)){
            uncommnet = false;
            break;
        }
    }


    if(uncommnet){
        for(let i = 0; i < value.length; i++){
            value[i] = value[i].replace(commentHead, '').replace(commentTail, '');
        }
    }else{
        for(let i = 0; i < value.length; i++){
            value[i] = commentHead+value[i]+commentTail;
        }
    }
    //Buffer the selection set

    getEditor().replaceRange(value,min,max);
    max.ch += commentHead.length + commentTail.length;

    getEditor().setSelection(min,max);
}

function find(){
    getEditor().execCommand("find");
}

function replace(){
    getEditor().execCommand("replace");
}

function toHex(decimal){
    let out = decimal.toString(16);
    while(out.length < 6){
        out = '0'+out;
    }
    return '#'+out;
}