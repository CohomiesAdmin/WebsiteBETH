import { BETH_GLOBAL } from "./global";

const swapScript = `
  <script>
  $RC = function(newId, oldId) {
    let newContentDiv = document.getElementById(newId);
    let oldTemplate = document.getElementById(oldId);

    // Check for existence of both elements
    if (!newContentDiv || !oldTemplate) return;

    // Start from the next sibling of the template to find the fallback content
    let currentNode = oldTemplate.nextSibling;

    // Iterate and remove nodes until the <!--/$--> comment is found
    while (currentNode) {
        if (currentNode.nodeType === 8 && currentNode.data === "/$") {
            // Found the ending comment; break out of the loop
            break;
        }
        let nextNode = currentNode.nextSibling;
        currentNode.remove();
        currentNode = nextNode;
    }

    // Insert the new content in the place of the fallback
    oldTemplate.parentNode.insertBefore(newContentDiv, oldTemplate.nextSibling);

    // Remove the old template
    oldTemplate.remove();

    // Unhide the new content
    newContentDiv.removeAttribute('hidden');
  };
  </script>
`;

export async function Suspense({
  fallback,
  children,
}: {
  fallback: JSX.Element;
  children: JSX.Element | JSX.Element[];
}): Promise<string> {
  if (!Array.isArray(children))
    throw new Error("children isnt array (shouldnt be possible)");

  const hasAnyUnresolvedPromiseChildren = children.reduce(
    (acc, child) => acc || Bun.peek.status(child) !== "fulfilled",
    false
  );

  if (!hasAnyUnresolvedPromiseChildren) {
    return children.join("");
  }

  const suspended = Promise.all(children);
  suspended.then((childrenContent) => {
    setTimeout(() => {
      console.log("dismissing children", childrenContent);
      const id = BETH_GLOBAL.dismissChild(children);
      if (!id) {
        BETH_GLOBAL.streamController?.error("Suspense children not found");
        throw new Error("Suspense children not found");
      }
      const content = childrenContent.join("");

      let withScript = `
        <div hidden id="N:${id}">
            ${content}
        </div>
        <script>
            $RC("N:${id}", "B:${id}");
        </script>
    `;

      if (!BETH_GLOBAL.sentFirstChunk) {
        withScript = swapScript + withScript;
        BETH_GLOBAL.sentFirstChunk = true;
      }

      console.log("sending", withScript);
      BETH_GLOBAL.streamController?.enqueue(withScript);

      console.log("here");
      BETH_GLOBAL.checkIfEnd();
    }, 0);
  });
  return fallback;
}
