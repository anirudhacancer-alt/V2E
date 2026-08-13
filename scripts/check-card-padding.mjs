#!/usr/bin/env node

/**
 * Enact UI Padding Quality Check
 * 
 * Detects double padding issues in Card components.
 * Run with: node scripts/check-card-padding.mjs
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = './apps/field-app/src';
const CARD_COMPONENTS = ['Card', 'SupervisorEntityCard'];

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  reset: '\x1b[0m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Find all .tsx files recursively
function findTsxFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !item.includes('node_modules')) {
      findTsxFiles(fullPath, files);
    } else if (stat.isFile() && extname(item) === '.tsx') {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Check if a line contains a Card opening tag
function getCardType(line) {
  for (const cardType of CARD_COMPONENTS) {
    // Match <Card or <SupervisorEntityCard at start of tag
    const regex = new RegExp(`<${cardType}\\b`);
    if (regex.test(line)) {
      return cardType;
    }
  }
  return null;
}

// Check if a line is the closing tag for a card type
function isCardClosing(line, cardType) {
  const regex = new RegExp(`</${cardType}>`);
  return regex.test(line);
}

// Check if line has problematic padding (p-4 and above, or arbitrary values like p-[14px])
function hasExplicitPadding(line) {
  // Look for className="...p-4..." or className='...p-4...'
  const hasStandardPadding = /className=["'][^"']*\bp-([4-9]|[1-9][0-9])\b[^"']*["']/.test(line);
  // Look for arbitrary padding like p-[14px], p-[16px], etc.
  const hasArbitraryPadding = /className=["'][^"']*\bp-\[\d+px?\][^"']*["']/.test(line);
  return hasStandardPadding || hasArbitraryPadding;
}

// Extract padding values from className (only p-4 and above, or arbitrary values)
function extractPaddingValues(line) {
  const standardMatches = line.match(/\bp-([4-9]|[1-9][0-9])\b/g) || [];
  const arbitraryMatches = line.match(/\bp-\[\d+px?\]/g) || [];
  return [...standardMatches, ...arbitraryMatches];
}

// Check a file for padding issues
function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];
  
  let cardStack = []; // Stack of currently open cards
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    // Check for Card opening
    const cardType = getCardType(line);
    if (cardType) {
      // Check if Card itself has padding in className
      if (hasExplicitPadding(line)) {
        const paddingValues = extractPaddingValues(line);
        issues.push({
          file: filePath,
          cardType: cardType,
          startLine: lineNumber,
          isSelfPadding: true,
          padding: paddingValues,
          content: line.trim(),
        });
      }
      
      cardStack.push({
        type: cardType,
        startLine: lineNumber,
        children: [],
      });
      continue;
    }
    
    // Check for Card closing
    if (cardStack.length > 0) {
      const currentCard = cardStack[cardStack.length - 1];
      if (isCardClosing(line, currentCard.type)) {
        // Process completed card
        const cardIssues = checkCardChildren(currentCard);
        if (cardIssues.length > 0) {
          issues.push({
            file: filePath,
            cardType: currentCard.type,
            startLine: currentCard.startLine,
            children: cardIssues,
          });
        }
        cardStack.pop();
        continue;
      }
    }
    
    // If we're inside a card, track direct children with padding
    if (cardStack.length > 0) {
      const currentCard = cardStack[cardStack.length - 1];
      
      // Check if this line starts a new element (simple check for <tag or <Component)
      const elementMatch = line.match(/<(\w+|[A-Z][a-zA-Z0-9]*)/);
      if (elementMatch && hasExplicitPadding(line)) {
        const paddingValues = extractPaddingValues(line);
        currentCard.children.push({
          line: lineNumber,
          content: line.trim(),
          padding: paddingValues,
        });
      }
    }
  }
  
  return issues;
}

// Check if children of a card have padding issues
function checkCardChildren(card) {
  const issues = [];
  
  for (const child of card.children) {
    // Any explicit padding inside Card is suspicious
    // Card already provides p-4, so children shouldn't add more
    issues.push(child);
  }
  
  return issues;
}

// Main execution
function main() {
  log('green', '🔍 Checking for Card padding issues...\n');
  
  const files = findTsxFiles(SRC_DIR);
  let totalIssues = 0;
  let filesWithIssues = 0;
  
  for (const file of files) {
    const issues = checkFile(file);
    
    if (issues.length > 0) {
      filesWithIssues++;
      totalIssues += issues.reduce((sum, issue) => {
        if (issue.isSelfPadding) {
          return sum + 1;
        }
        return sum + issue.children.length;
      }, 0);
      
      log('red', `\n❌ ${file}`);
      
      for (const issue of issues) {
        if (issue.isSelfPadding) {
          log('yellow', `  Card "${issue.cardType}" at line ${issue.startLine} has padding in className:`);
          log('gray', `    ${issue.content.substring(0, 80)}...`);
          log('gray', `    Padding found: ${issue.padding.join(', ')}`);
        } else {
          log('yellow', `  Card "${issue.cardType}" at line ${issue.startLine}:`);
          
          for (const child of issue.children) {
            log('gray', `    Line ${child.line}: ${child.content.substring(0, 80)}...`);
            log('gray', `    Padding found: ${child.padding.join(', ')}`);
          }
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (totalIssues === 0) {
    log('green', '✅ No padding issues found!');
    process.exit(0);
  } else {
    log('red', `❌ Found ${totalIssues} issue(s) in ${filesWithIssues} file(s)`);
    log('gray', '\n💡 Tip: Card components already have built-in p-4 padding.');
    log('gray', '   Remove explicit padding from direct children.');
    process.exit(1);
  }
}

main();
