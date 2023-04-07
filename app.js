import axios from 'axios';
import inquirer from 'inquirer';
import fs from 'fs';
import {config} from 'dotenv';

config();

const historyFile = 'history.json';
const settings = {
  model: process.env.MODEL,
  apiKey: process.env.API_KEY,
  apiUrl: process.env.API_URL,
};
const itemsPerPage = 5;

function loadHistory() {
  if (!fs.existsSync(historyFile)) {
    return [];
  }
  const data = fs.readFileSync(historyFile, 'utf8');
  return JSON.parse(data);
}

function saveHistory(history) {
  fs.writeFileSync(historyFile, JSON.stringify(history), 'utf8');
}

function exportHistoryAsCSV(history) {
  const header = 'Prompt,Response\n';
  const rows = history.map(item => `"${item.prompt}","${item.response}"`).join('\n');
  const csvContent = header + rows;

  fs.writeFileSync('history.csv', csvContent, 'utf8');
}

function exportHistoryAsTXT(history) {
  const txtContent = history.map(item => `Prompt: ${item.prompt}\nResponse: ${item.response}\n`).join('\n');

  fs.writeFileSync('history.txt', txtContent, 'utf8');
}

async function displayTypingAnimation(text, delay = 50) {
  return new Promise((resolve) => {
    let currentCharIndex = 0;

    function printNextChar() {
      process.stdout.write(text[currentCharIndex]);
      currentCharIndex++;

      if (currentCharIndex < text.length) {
        setTimeout(printNextChar, delay);
      } else {
        process.stdout.write('\n');
        resolve();
      }
    }

    printNextChar();
  });
}

async function generateResponse(prompt) {
  try {
    const response = await axios.post(settings.apiUrl, {
      model: settings.model,
      prompt: prompt,
      max_tokens: 4000
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
    });
    //console.log(JSON.stringify(response.data.choices[0].text))
    return response.data.choices[0].text;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

async function main() {
  let history = loadHistory();

  while (true) {
    const {action} = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          'Generate ChatGPT prompt',
          'View history',
          'Export history',
          'Exit',
        ],
      },
    ]);

    if (action === 'Generate ChatGPT prompt') {
      const {prompt} = await inquirer.prompt([
        {
          type: 'input',
          name: 'prompt',
          message: 'Enter your prompt:',
        },
      ]);

      const response = await generateResponse(prompt);

      if (response) {
        await displayTypingAnimation(response)
        history.push({prompt, response});
        saveHistory(history);
      }
    } else if (action === 'View history') {
      if (history.length === 0) {
        console.log('\nThere is no history to display.\n');
      } else {
        let currentPage = 0;
        while (true) {
          const startIndex = currentPage * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const pageItems = history.slice(startIndex, endIndex);

          const {selected} = await inquirer.prompt([
            {
              type: 'list',
              name: 'selected',
              message: 'Select a conversation:',
              choices: pageItems.map((item, index) => ({
                name: `[PROMPT] : ${item.prompt} - [RESPONSE] : ${item.response}`,
                value: index + startIndex,
              })).concat([
                new inquirer.Separator(),
                {name: 'Previous page', value: -2},
                {name: 'Next page', value: -3},
                {name: 'Back', value: -1},
              ]),
            },
          ]);

          if (selected === -1) {
            break;
          } else if (selected === -2) {
            if (currentPage > 0) {
              currentPage--;
            }
          } else if (selected === -3) {
            if (endIndex < history.length) {
              currentPage++;
            }
          } else {
            console.log(`\nUser: ${history[selected].user}`);
            console.log(`ChatGPT: ${history[selected].chatgpt}\n`);
          }
        }
      }
    } else if (action === 'Export history') { // Add this new condition
      if (history.length === 0) {
        console.log('\nThere is no history to export.\n');
      } else {
        const {format} = await inquirer.prompt([
          {
            type: 'list',
            name: 'format',
            message: 'Choose the export format:',
            choices: [
              'CSV',
              'TXT',
              'Back',
            ],
          },
        ]);

        if (format === 'CSV') {
          exportHistoryAsCSV(history);
          console.log('\nHistory has been exported as history.csv.\n');
        } else if (format === 'TXT') {
          exportHistoryAsTXT(history);
          console.log('\nHistory has been exported as history.txt.\n');
        }
      }
    } else {
      await displayTypingAnimation('Goodbye!');
      break;
    }
  }
}

main();
