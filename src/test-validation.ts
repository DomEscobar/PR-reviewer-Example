// Test file for line validation
export function testFunction() {
  console.log('Line 3');
  console.log('Line 4');
  console.log('Line 5');
  console.log('Line 6');
  console.log('Line 7');
  console.log('Line 8');
  console.log('Line 9');
  console.log('Line 10');
  return 'This has a bug on line 11';
}

export function anotherFunction() {
  // Missing validation here on line 15
  const data = fetch('/api');
  return data.json();
}

