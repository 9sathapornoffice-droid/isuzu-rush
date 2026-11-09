const cp = require('child_process');
const fs = require('fs');

const gitExe = 'C:\\Users\\ASUS\\AppData\\Local\\Programs\\MinGit\\cmd\\git.exe';
const repoDir = 'C:\\Users\\ASUS\\.gemini\\antigravity\\scratch\\isuzu-rush';

const buf = cp.execFileSync(gitExe, ['-C', repoDir, 'show', '9cefc91~1:public/index.html']);
fs.writeFileSync(repoDir + '/public/index.template.html', buf);
console.log('Successfully wrote index.template.html with byte length:', buf.length);
