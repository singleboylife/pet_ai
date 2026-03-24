const COS = require('cos-nodejs-sdk-v5')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const cos = new COS({
  SecretId:  process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY
})

const BUCKET = process.env.COS_BUCKET
const REGION = process.env.COS_REGION
const BASE_URL = process.env.COS_BASE_URL

function uploadBuffer(buffer, cosKey, contentType = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    cos.putObject({
      Bucket: BUCKET,
      Region: REGION,
      Key:    cosKey,
      Body:   buffer,
      ContentType: contentType
    }, (err, data) => {
      if (err) return reject(err)
      resolve(`${BASE_URL}/${cosKey}`)
    })
  })
}

function avatarKey(userId, ext = '.jpg') {
  return `user/avatars/${userId}_${uuidv4()}${ext}`
}

function postImageKey(userId, ext = '.jpg') {
  return `user/posts/${userId}_${uuidv4()}${ext}`
}

function productImageKey(productId, index, ext = '.jpg') {
  return `mall/products/images/${productId}_${index}_${uuidv4()}${ext}`
}

function productVideoKey(productId, ext = '.mp4') {
  return `mall/products/videos/${productId}_${uuidv4()}${ext}`
}

function productDetailKey(productId, index, ext = '.jpg') {
  return `mall/products/details/${productId}_${index}_${uuidv4()}${ext}`
}

function merchantLogoKey(merchantId, ext = '.jpg') {
  return `mall/merchants/logos/${merchantId}_${uuidv4()}${ext}`
}

function merchantLicenseKey(merchantId, ext = '.jpg') {
  return `mall/merchants/licenses/${merchantId}_${uuidv4()}${ext}`
}

function merchantBannerKey(merchantId, ext = '.jpg') {
  return `mall/merchants/banners/${merchantId}_${uuidv4()}${ext}`
}

function getUrl(key) {
  if (!key) return ''
  if (key.startsWith('http')) return key
  return `${BASE_URL}/${key}`
}

module.exports = {
  cos, uploadBuffer, avatarKey, postImageKey,
  productImageKey, productVideoKey, productDetailKey,
  merchantLogoKey, merchantLicenseKey, merchantBannerKey,
  getUrl, BUCKET, REGION, BASE_URL
}

