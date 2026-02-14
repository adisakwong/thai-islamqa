function doGet(e) {
  // If the 'url' parameter is present, treat it as an API call
  if (e.parameter && e.parameter.url) {
    var result = scrapeAndTranslate(e.parameter.url);
    var output = ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  // Otherwise, serve the HTML page (for when opening the Web App directly)
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('IslamQA Translator (TH)')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Scrapes data from islamqa.info and translates it to Thai
 * @param {string} url - The URL to scrape
 * @return {Object} - The scrapped and translated data
 */
function scrapeAndTranslate(url) {
  try {
    // Basic validation
    if (!url.includes('islamqa.info')) {
      throw new Error('URL must be from islamqa.info');
    }

    // Fetch the HTML content
    var html = UrlFetchApp.fetch(url, {
      'muteHttpExceptions': true,
      'headers': {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }).getContentText();

    // Extract Data using Regex (Robust approach based on observed structure)
    // 1. Title
    var titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    var title = titleMatch ? stripHtml(titleMatch[1]).trim() : 'No Title Found';

    // 2. Question Content
    // --- Improved Extraction Logic : Position Based ---
    
    // Convert HTML to a simpler string for searching positions (keep tags for stripHtml later)
    // We look for specific headers that define the sections
    // Patterns:
    // Question: Look for ">Question" or "> Question"
    // Summary: Look for ">Summary of answer"
    // Answer: Look for ">Answer"
    
    // Helper to find position of a header pattern
    function findHeaderPos(htmlStr, pattern) {
       var match = htmlStr.match(pattern);
       return match ? match.index + match[0].length : -1;
    }
    
    // 1. Locate Markers
    // We use a regex that matches the closing of a tag > followed by the keyword
    // 1. Locate Markers
    // We use a regex that matches the opening of a tag > followed by the keyword
    // IMPORTANT: We do NOT consume the trailing < so that the closing tag remains for stripHtml to handle (e.g. </h2>)
    var qPattern = />\s*Question\b[^<]*/i; // matches >Question, >Question 1, >Question: 1
    var sPattern = />\s*Summary\b[^<]*/i;  // matches >Summary, >Summary of answer
    var aPattern = />\s*Answer\b[^<]*/i;    // matches >Answer
    
    var qIndex = findHeaderPos(html, qPattern);
    var sIndex = findHeaderPos(html, sPattern);
    var aIndex = findHeaderPos(html, aPattern);
    
    // 2. Extract Content based on indices
    var rawQ = "", rawS = "", rawA = "";
    
    // Helper to find the start of the tag that contains the match (look backwards for '<')
    function findTagStart(str, index) {
        if (!str || index < 0) return -1;
        return str.lastIndexOf('<', index);
    }

    var qMatch = html.match(qPattern);
    var sMatch = html.match(sPattern);
    var aMatch = html.match(aPattern);
    
    // Start positions (after the text of the header, e.g. >Question)
    var qStartPos = qMatch ? qMatch.index + qMatch[0].length : -1;
    var sStartPos = sMatch ? sMatch.index : -1; 
    var aStartPos = aMatch ? aMatch.index : -1;
    
    // Better Cut Positions: Start of the header tag (e.g. <h2...)
    var sTagStart = sMatch ? findTagStart(html, sMatch.index) : -1;
    var aTagStart = aMatch ? findTagStart(html, aMatch.index) : -1;

    // Extraction: Question
    if (qStartPos > -1) {
         var qCutEnd = -1;
         
         // Priority: Summary tag, then Answer tag
         if (sTagStart > qStartPos) qCutEnd = sTagStart;
         else if (aTagStart > qStartPos) qCutEnd = aTagStart;
         
         if (qCutEnd > -1) {
             rawQ = html.substring(qStartPos, qCutEnd);
         } else {
             // Fallback: Just take a chunk if no end marker found
             // But usually there is an footer or Answer
             rawQ = html.substring(qStartPos, qStartPos + 5000); 
         }
    }
    
    // Extraction: Summary
    if (sStartPos > -1) {
         // Summary content starts after >Summary...
         // Wait, sStartPos above was sMatch.index in original code? 
         // logic for START of content: match.index + match.length
         var sContentStart = sMatch ? sMatch.index + sMatch[0].length : -1;
         
         var sCutEnd = -1;
         if (aTagStart > sContentStart) sCutEnd = aTagStart;
         
         if (sContentStart > -1 && sCutEnd > sContentStart) {
             rawS = html.substring(sContentStart, sCutEnd);
         }
    }
    
    // Extraction: Answer
    if (aStartPos > -1) {
        // Content starts after >Answer...
        // Logic above for aStartPos was aMatch.index. We need end of match.
        var aContentStart = aMatch ? aMatch.index + aMatch[0].length : -1;
        
        if (aContentStart > -1) {
            var fullRest = html.substring(aContentStart);
            
            // Truncate at "Reference", "Source", or "Related"
            var footerPattern = /(?:class=["']reference["']|class=["']source["']|<section[^>]*class=["'][^"']*related|class=["'][^"']*widget-related|<div[^>]*class=["']content-related|>\s*(?:Reference|Source)\b[^<]*)/i;
            var footerMatch = fullRest.match(footerPattern);
            
            if (footerMatch) {
                // If the footer match is a tag content >Reference, find its tag start
                var fIndex = footerMatch.index;
                // If match starts with >, find tag start
                if (footerMatch[0].trim().startsWith('>')) {
                    var fTagStart = findTagStart(fullRest, fIndex);
                    if (fTagStart > -1) fIndex = fTagStart;
                }
                
                rawA = fullRest.substring(0, fIndex);
            } else {
                rawA = fullRest;
            }
        }
    }

    // 3. Clean and Translate
    var cleanQ = stripHtml(rawQ).trim();
    var cleanS = stripHtml(rawS).trim();
    var cleanA = stripHtml(rawA).trim();
    
    // Extra cleanup for Answer: Remove "Table Of Contents" text artifacts
    cleanA = cleanA.replace(/^Table Of Contents\s*[\s\S]*?(?:\n\n|$)/i, ""); 
    // The above regex attempts to remove TOC at start. 
    // It assumes TOC is followed by double newline from our stripHtml.
    
    if (!cleanQ) cleanQ = "No Question found (Check URL or structure)";
    if (!cleanA) cleanA = "No Answer found (Check URL or structure)";

    // Detect Language
    var sourceLang = ''; 
    var langMatch = url.match(/islamqa\.info\/([a-z]{2})\//);
    if (langMatch && langMatch[1]) {
      sourceLang = langMatch[1];
    }

    // Helper ...
    function safeTranslate(text, source, target) {
      if (!text) return "";
      try {
        return LanguageApp.translate(text, source || '', target);
      } catch (e) {
        return text + " (Translation Error)";
      }
    }
    
    function translateLongText(text, source) {
        if (!text) return "";
        try {
            var chunks = text.split(/\n\n+/);
            return chunks.map(function(chunk) {
               return safeTranslate(chunk.trim(), source, 'th');
            }).join('\n\n');
        } catch (e) {
            return text + " (Translation Failed)";
        }
    }

    // Translate
    var translatedTitle = safeTranslate(title, sourceLang, 'th');
    var translatedQ = safeTranslate(cleanQ, sourceLang, 'th');
    var translatedS = safeTranslate(cleanS, sourceLang, 'th');
    var translatedA = translateLongText(cleanA, sourceLang);

    return {
      success: true,
      original: {
        title: title,
        url: url
      },
      translated: {
        title: translatedTitle,
        question: translatedQ,
        summary: translatedS,
        answer: translatedA
      }
    };

    return {
      success: true,
      original: {
        title: title,
        url: url
      },
      translated: {
        title: translatedTitle,
        question: translatedQ,
        answer: translatedA
      }
    };

  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

function stripHtml(html) {
  if (!html) return "";
  
  // 1. Remove comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  
  // 2. Insert newlines for block elements (closing tags)
  var withBreaks = html.replace(/<\/(div|p|h\d|li|br|ul|ol|tr)>/gi, '\n\n')
                       .replace(/<br\s*\/?>/gi, '\n');
  
  // 3. Remove all other tags
  // Also remove partial tags at the start of string (e.g. "ass='...'>")
  // and partial tags at the end of string (e.g. "<div")
  // But be careful not to remove " < 5" (math). 
  // We assume tags start with < and end with >.
  var text = withBreaks.replace(/<[^>]+>/g, ' ');
  
  // Remove partial opening tag at the end (common in our substring logic)
  text = text.replace(/<[\w\s="'-]*$/g, '');
  
  // 4. Decode HTML Entities
  text = decodeEntities(text);
  
  // 5. Clean up whitespace
  text = text.replace(/[ \t]+/g, ' ');       // Collapse horizontal whitespace
  text = text.replace(/\n\s/g, '\n');    // Remove space after newline
  text = text.replace(/\s\n/g, '\n');    // Remove space before newline
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
  
  return text.trim();
}

function decodeEntities(text) {
  if (!text) return "";
  // Basic entity map
  var entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&copy;': '©',
    '&reg;': '®',
    '&ndash;': '-',
    '&mdash;': '-',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&ldquo;': '"',
    '&rdquo;': '"'
  };
  
  // Replace standard entities
  return text.replace(/&[a-z0-9#]+;/gi, function(match) {
    if (entities[match]) return entities[match];
    // Handle numeric entities &#123; or &#xABC;
    if (match.startsWith('&#')) {
       try {
         var code = match.substring(2, match.length - 1);
         var num = code.startsWith('x') ? parseInt(code.substring(1), 16) : parseInt(code, 10);
         if (!isNaN(num)) return String.fromCharCode(num);
       } catch(e) {}
    }
    return match; // Return as is if not known
  });
}
