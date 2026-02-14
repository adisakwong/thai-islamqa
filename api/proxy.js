export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
        return new Response(JSON.stringify({ error: 'Missing endpoint parameter' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
        });
    }

    try {
        const response = await fetch(endpoint);
        const data = await response.text();

        return new Response(data, {
            status: 200,
            headers: {
                'content-type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
        });
    }
}
