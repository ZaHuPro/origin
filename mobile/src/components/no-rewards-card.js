'use strict'

import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { fbt } from 'fbt-runtime'

import OriginButton from 'components/origin-button'
import CommonStyles from 'styles/common'
import CardStyles from 'styles/card'

const IMAGES_PATH = '../../assets/images/'

const NoRewardsCard = props => (
  <View style={styles.container}>
    <View style={styles.card}>
      <View style={styles.fullWidthImageContainer}>
        <Image
          resizeMethod={'scale'}
          resizeMode={'cover'}
          source={require(IMAGES_PATH + 'tout-header-image.png')}
          style={styles.image}
        />
      </View>
      <Text style={styles.cardHeading}>
        <fbt desc="NoRewardsCard.title">
          Are you sure you don&apos;t want Origin Rewards?
        </fbt>
      </Text>
      <Text style={styles.cardContent}>
        <Text style={styles.subtitle}>
          <fbt desc="NoRewardsCard.subtitle">
            Your new wallet will be ineligible to earn OGN.
          </fbt>
        </Text>
      </Text>
      <View style={styles.buttonContainer}>
        <OriginButton
          size="large"
          type="primary"
          title={fbt("I'm sure", 'NoRewardsCard.continue')}
          onPress={props.onConfirm}
        />
        <OriginButton
          size="large"
          type="primary"
          title={fbt('No, wait', 'NoRewardsCard.goBack')}
          onPress={props.onRequestClose}
          outline
        />
      </View>
    </View>
  </View>
)

export default NoRewardsCard

const styles = StyleSheet.create({
  ...CommonStyles,
  ...CardStyles,
  fullWidthImageContainer: {
    marginHorizontal: -20,
    marginTop: -30,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden'
  },
  image: {
    width: '100%'
  }
})
