const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000; // Use environment port

app.use(cors());
app.use(express.json());

const getAllUrlsFromPage = async (url) => {
    console.time('getAllUrlsFromPage');
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const urls = new Set();

        $('a, img, video').each((_, element) => {
            let href = $(element).attr('href') || $(element).attr('src');
            if (href) {
                href = href.startsWith('http') ? href : new URL(href, url).href;
                urls.add(href);
            }
        });
        console.timeEnd('getAllUrlsFromPage');
        return Array.from(urls);
    } catch (error) {
        console.error('Error in getAllUrlsFromPage:', error.message);
        throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
};

const getFinalRedirectUrl = async (url) => {
    console.time('getFinalRedirectUrl');
    try {
        const response = await axios.get(url, {
            maxRedirects: 10,
            validateStatus: status => status >= 200 && status < 400
        });
        console.timeEnd('getFinalRedirectUrl');
        return response.request.res.responseUrl;
    } catch (error) {
        console.error('Error in getFinalRedirectUrl:', error.message);
        if (error.response) {
            return error.response.request.res.responseUrl || 'No final URL found';
        } else {
            throw new Error(`Failed to fetch ${url}: ${error.message}`);
        }
    }
};


app.post('/api/check-site-urls', async (req, res) => {
    const { siteUrl } = req.body;
    if (!siteUrl) {
        return res.status(400).json({ error: 'Site URL is required' });
    }

    try {
        const urls = await getAllUrlsFromPage(siteUrl);
        const results = await Promise.all(urls.map(async (url) => {
            try {
                const finalUrl = await getFinalRedirectUrl(url);
                return { originalUrl: url, finalUrl };
            } catch (error) {
                return { originalUrl: url, finalUrl: `Error: ${error.message}` };
            }
        }));

        res.json(results);
    } catch (error) {
        console.error('Error processing request:', error.message);
        res.status(500).json({ error: 'An error occurred', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
