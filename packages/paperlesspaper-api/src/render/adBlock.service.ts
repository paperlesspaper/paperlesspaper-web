export async function adBlock(page: any): Promise<void> {
  // Search for the text and click on it, including within iframes
  const textToSearch = '^(Alle akzeptieren|Akzeptieren|Verstanden|Zustimmen|Okay|OK|Zustimmen und weiter)$';
  const selectors = '[id*=cookie] a, [class*=cookie] a, [id*=cookie] button, [class*=cookie] button, a, button';

  async function clickElementByText(page: any, text: string, selectors: string): Promise<void> {
    // Function to search and click in the main frame
    await page.evaluate(
      (text: string, selectors: string) => {
        function xcc_contains(selector: string, text: string): HTMLElement[] {
          const elements = document.querySelectorAll(selector);
          return Array.prototype.filter.call(elements, (element: HTMLElement) => {
            return RegExp(text, 'i').test(element.textContent?.trim() || '');
          });
        }
        const _xcc = xcc_contains(selectors, text);
        if (_xcc != null && _xcc.length !== 0) {
          //console.log('found cookie in main frame');
          _xcc[0].click();
        }
      },
      text,
      selectors,
    );

    // Iterate through all iframes and perform the search and click
    const frames = await page.frames();
    for (const frame of frames) {
      //console.log('frame', frame.url());
      await frame.evaluate(
        (text: string, selectors: string) => {
          function xcc_contains(selector: string, text: string): HTMLElement[] {
            const elements = document.querySelectorAll(selector);
            return Array.prototype.filter.call(elements, (element: HTMLElement) => {
              return RegExp(text, 'i').test(element.textContent?.trim() || '');
            });
          }
          const _xcc = xcc_contains(selectors, text);
          if (_xcc != null && _xcc.length !== 0) {
            //console.log('found cookie in iframe');
            _xcc[0].click();
          }
        },
        text,
        selectors,
      );
    }
  }

  await clickElementByText(page, textToSearch, selectors);
}

export default {
  adBlock,
};
