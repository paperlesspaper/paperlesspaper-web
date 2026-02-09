export async function getTranslationsByNamespace(namespace, lng) {
  const data = await fetch(
    `${
      import.meta.env.REACT_APP_WEB_BACKEND_URL
    }/translations?limit=1000&namespace=${namespace}&locale=${lng}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  return data;
}

export async function createMissingTranslation({
  content,
  namespace,
  language,
  key,
}) {
  const data = await fetch(
    `${import.meta.env.REACT_APP_WEB_BACKEND_URL}/translations/create-missing`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        content: content ? content : key,
        namespace,
        language,
        secret: import.meta.env.REACT_APP_TRANSLATION_SECRET,
      }),
    }
  );
  return data;
}

export const loadResources = async (language, namespace) => {
  const response: any = await getTranslationsByNamespace(namespace, language);

  const results = {};
  if (response.docs) {
    response.docs.forEach((element) => {
      results[element.key] = element.translation[0].content;
    });
  }

  return results;
};

export const updateResources = async (
  language,
  namespace,
  url,
  options,
  payload
) => {
  console.log("create missing translation", payload, namespace, language, url);

  await createMissingTranslation({
    key: Object.entries(payload)[0][0],
    content: Object.entries(payload)[0][1],
    namespace: namespace,
    language: "en",
    //changeDate: today.toISOString(),
  });
};

export const backendOptions = {
  addPath: "{{lng}}|{{ns}}|add",
  loadPath: "{{lng}}|{{ns}}",
  request: (options, url, payload, callback) => {
    try {
      const [lng, ns, add] = url.split("|");

      if (add === "add") {
        updateResources(lng, ns, url, options, payload).then((response) => {
          callback(null, {
            data: JSON.stringify(response),
            status: 200,
          });
        });
      } else {
        loadResources(lng, ns).then((response) => {
          callback(null, {
            data: JSON.stringify(response),
            status: 200,
          });
        });
      }
    } catch (e) {
      console.log("error");
      console.error(e);
      callback(null, {
        status: 500,
      });
    }
  },
};
