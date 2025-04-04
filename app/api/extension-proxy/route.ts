import { NextResponse } from 'next/server';

/**
 * Extension proxy endpoint that forwards requests from the Chrome extension to LocalStack
 * This bypasses CORS restrictions since the Next.js API routes can communicate with LocalStack
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const data = await request.json();
    const { url, method, headers, body } = data;
    
    console.log(`Extension proxy: ${method} ${url}`);
    
    // Forward the request to LocalStack
    const fetchOptions: RequestInit = {
      method,
      headers,
    };
    
    // Only add body for non-GET requests
    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    
    // Make the request to LocalStack
    const response = await fetch(url, fetchOptions);
    
    // Check for successful response
    if (!response.ok) {
      throw new Error(`LocalStack responded with status: ${response.status}`);
    }
    
    // Parse response based on content type
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else if (contentType && contentType.includes('application/xml') || 
               contentType && contentType.includes('text/xml')) {
      // For XML responses (common with some AWS services)
      result = await response.text();
      return new NextResponse(result, {
        status: 200,
        headers: { 'Content-Type': contentType }
      });
    } else {
      // For other types of responses
      result = await response.text();
    }
    
    console.log(`Extension proxy: Successfully proxied request to ${url}`);
    
    // Return the result
    return NextResponse.json(result);
  } catch (error) {
    console.error('Extension proxy error:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
