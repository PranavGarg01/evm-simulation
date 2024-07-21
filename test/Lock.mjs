import hre from "hardhat";
const { ethers } = hre;
import Table from 'cli-table3';
import readline from 'readline';
import chalk from 'chalk';

class TraceNode {
  constructor(data) {
    this.data = data;
    this.children = [];
  }

  addChild(child) {
    this.children.push(child);
  }
}

function buildTraceTree(trace) {
  const root = new TraceNode({ depth: -1, op: "ROOT" });
  const stack = [root];

  for (const step of trace.structLogs) {
    const node = new TraceNode(step);
    
    while (stack[stack.length - 1].data.depth >= step.depth) {
      stack.pop();
    }
    
    stack[stack.length - 1].addChild(node);
    stack.push(node);
  }

  return root.children;
}

function formatMemory(memory) {
  if (typeof memory === 'string') {
    return memory.match(/.{1,64}/g).join('\n');
  } else if (Array.isArray(memory)) {
    return memory.map(chunk => chunk.padStart(64, '0')).join('\n');
  } else if (memory) {
    return JSON.stringify(memory, null, 2);
  }
  return 'No memory data';
}

function displayTrace(traceTree, currentIndex) {
  console.clear();
  
  const currentNode = traceTree[currentIndex];

  const table = new Table({
    head: ['Category', 'Data'],
    colWidths: [15, 150]
  });

  // Display opcodes
  let opcodes = [];
  for (let i = Math.max(0, currentIndex - 2); i <= Math.min(traceTree.length - 1, currentIndex + 2); i++) {
    if (i === currentIndex) {
      opcodes.push(chalk.blue(`> ${traceTree[i].data.op}`));
    } else {
      opcodes.push(`  ${traceTree[i].data.op}`);
    }
  }

  table.push(
    ['Opcodes', opcodes.join('\n')],
    ['Stack', currentNode.data.stack ? currentNode.data.stack.slice().reverse().join('\n') : 'Empty stack'],
    ['Memory', formatMemory(currentNode.data.memory)],
    ['Storage', currentNode.data.storage ? 
      Object.entries(currentNode.data.storage).map(([key, value]) => `${key}: ${value}`).join('\n') : 
      'No storage changes'
    ]
  );

  console.log(table.toString());
  console.log(`\nOpcode ${currentIndex + 1} of ${traceTree.length}`);
  console.log('\n↑/↓ : Previous/Next Opcode');
  console.log('q: Quit');
}

async function interactiveExploration(traceTree) {
  let currentIndex = 0;

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  displayTrace(traceTree, currentIndex);

  return new Promise((resolve) => {
    process.stdin.on('keypress', (str, key) => {
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        console.log('Exiting...');
        resolve();
      } else if (key.name === 'up' && currentIndex > 0) {
        currentIndex--;
        displayTrace(traceTree, currentIndex);
      } else if (key.name === 'down' && currentIndex < traceTree.length - 1) {
        currentIndex++;
        displayTrace(traceTree, currentIndex);
      }
    });
  });
}

async function main() {
  try {
    console.log("Deploying SimpleStorage contract...");
    const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
    const simpleStorage = await SimpleStorage.deploy();
    await simpleStorage.deployed();
    console.log("SimpleStorage deployed to:", simpleStorage.address);

    console.log("Simulating setValue transaction...");
    const tx = await simpleStorage.setValue(42);
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("Tracing transaction...");
    const trace = await hre.network.provider.send("debug_traceTransaction", [tx.hash]);
    
    console.log("Building trace tree...");
    const traceTree = buildTraceTree(trace);
    
    console.log("Starting interactive exploration...");
    await interactiveExploration(traceTree);
  } catch (e) {
    console.error(e);
  }
}

main()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });