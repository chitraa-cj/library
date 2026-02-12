const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('/tmp/isha_dev.html', 'utf8');
const ch = cheerio.load(html);

const v1 = ch('[id="IS_C01_V01"]');
console.log('V01 children:');
v1.children().each((i, el) => {
  console.log('  ' + ch(el).prop('tagName') + '.' + ch(el).attr('class') + ' id=' + ch(el).attr('id'));
});
console.log('V01 versetext:', v1.find('.versetext').text().substring(0, 150));

const v2 = ch('[id="IS_C01_V02"]');
console.log('\nV02 children:');
v2.children().each((i, el) => {
  console.log('  ' + ch(el).prop('tagName') + '.' + ch(el).attr('class') + ' id=' + ch(el).attr('id'));
});
console.log('V02 leading_bhashya:', v2.find('.leading_bhashya').text().substring(0, 150));
console.log('V02 versetext:', v2.find('.versetext').text().substring(0, 150));

// Count total verses
console.log('\nTotal verse divs:', ch('.verse').length);
console.log('Total bhashya divs:', ch('.bhashya').length);

// List all chapter direct children 
const chapter = ch('.chapter');
console.log('\nChapter direct children:');
chapter.children().each((i, el) => {
  const cls = ch(el).attr('class') || 'none';
  const id = ch(el).attr('id') || 'none';
  console.log('  ' + cls + ' id=' + id);
});
