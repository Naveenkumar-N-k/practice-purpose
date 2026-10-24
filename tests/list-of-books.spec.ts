import { test, expect } from '@playwright/test';
import { BooksClient, BooksHelper } from '../clients/books';
import { GetBooksQueryParam, Book } from '../clients/books';
import { verifyStatusCodeandReturnJSON, throwingError } from '../utilities/basic-utils';
import process from 'node:process';

test('list of books with valid query parameters', async ({request}) => {
  const booksClient = new BooksClient(request);
  const booksHelper = new BooksHelper(); 

  const queryParams = {
    type:booksHelper.validType(),
    limit:booksHelper.validLimit(),
  } satisfies GetBooksQueryParam; 
  booksHelper.validatingValidCredentials(queryParams);

  const response = await booksClient.getBooks(queryParams);
  const responseData = await verifyStatusCodeandReturnJSON(response, 200) as Book[];
  responseData.forEach( book => {
    expect(book).toMatchObject({
      id: expect.any(Number),
      type: expect.stringMatching(/(fiction|non-fiction)/i), 
    })
  })

  booksHelper.ensuringNoDuplicateBooks(responseData);
  booksHelper.ensuringValidBookIds(responseData);
  
  // Ensuring Valid Response for given query
    // valid type 
    let errorMessage = '';
    responseData.forEach(book => {
      if(book.type === queryParams.type){}
      else errorMessage += `Got type: ${book.type} (invalid value) on book id: ${book.id}\n`
    })
    if(errorMessage!=='') throwingError(errorMessage)
    
    // valid limit
    if (queryParams.type==='fiction'){
      if (queryParams.limit >= 4) expect(responseData).toHaveLength(4)
      else expect(responseData).toHaveLength(queryParams.limit)
    }else{
      if (queryParams.limit >= 2) expect(responseData).toHaveLength(2)
      else expect(responseData).toHaveLength(queryParams.limit)
    }
});