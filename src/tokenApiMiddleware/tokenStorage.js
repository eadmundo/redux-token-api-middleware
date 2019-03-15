export const storeToken = (key, response) => {
  const token = response.token;
  localStorage.setItem(key, JSON.stringify(token));
  return token;
};

export const removeToken = (key) => {
  localStorage.removeItem(key);
};
