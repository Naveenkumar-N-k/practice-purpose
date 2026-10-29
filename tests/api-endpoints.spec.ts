import { test, expect } from '@playwright/test';
import { BooksClient, BooksHelper } from '../clients/books';
import { GetBooksQueryParam, Book } from '../clients/books';
import { verifyStatusCodeandReturnJSON, throwingError } from '../utilities/basic-utils';
import { OrdersClient } from '../clients/orders';
import { Orders, OrderSubmissionResponse } from '../clients/orders';

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

test('Making Orders', async ({request}) => {
    // Making few (3) orders
    const ordersClient = new OrdersClient(request);

    const initialOrdersState = await ordersClient.getOrders();
    const initialOrdersStateData = await verifyStatusCodeandReturnJSON(initialOrdersState, 200) as Orders;
    const initialOrdersLength = initialOrdersStateData.length;
    
    const requestBodiesForSubmittingOrder = [await ordersClient.validOrderingData(), await ordersClient.validOrderingData(), await ordersClient.validOrderingData()];
    const orderIds:string[] = [];
    for (let orderCount = 1; orderCount <= 3; orderCount++) {
        const orderSubmissionResponse = await ordersClient.submitOrder(requestBodiesForSubmittingOrder[orderCount-1]);
        const orderSubmissionResponseData = await verifyStatusCodeandReturnJSON(orderSubmissionResponse, 201) as OrderSubmissionResponse;
        expect(orderSubmissionResponseData).toEqual({
            created: true,
            orderId: expect.any(String),
        });
        orderIds.push(orderSubmissionResponseData.orderId);
    }
    expect(orderIds).toHaveLength(3);

    // Get orders now
    const orders = await ordersClient.getOrders();
    const ordersData = await verifyStatusCodeandReturnJSON(orders, 200) as Orders;
    // Current orders (filtered using id (Order ID))
    const currentOrders = ordersData.filter(order => orderIds.includes(order.id));
    expect(currentOrders).toHaveLength(3);
    // No duplicates
    ordersClient.ensuringNoDuplicateOrders(currentOrders);
    ordersClient.ensuringConsistentOrders(currentOrders, orderIds, requestBodiesForSubmittingOrder);
    
    // Clean those orders
    for (const orderId of orderIds){
        const response = await ordersClient.deleteSpecificOrder(orderId);
        await verifyStatusCodeandReturnJSON(response, 204);        
        const orderIsResponse = await ordersClient.getSpecificOrder(orderId);
        const orderIsResponseData = await verifyStatusCodeandReturnJSON(orderIsResponse, 404) as {error:string};
        expect(orderIsResponseData).toEqual({
            error: `No order with id ${orderId}.`
        })
    }
    // Ensure the clean has done
    const cleanedOrders = await ordersClient.getOrders();
    const cleanedOrdersData = await verifyStatusCodeandReturnJSON(cleanedOrders, 200) as Orders;
    cleanedOrdersData.length === initialOrdersLength 
        ? undefined 
        : throwingError(`Orders Cleaning went wrong: \nInitial Orders Count → ${initialOrdersLength}, Cleaned Orders Count → ${cleanedOrdersData.length}`);

    let errorMessage = '';
    cleanedOrdersData.forEach(order => {
        orderIds.includes(order.id) ? errorMessage += `Order Id (${order.id}) has not cleaned, yet.` : undefined
    });
    errorMessage === '' ? undefined : throwingError(errorMessage);
});